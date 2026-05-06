# Perry Upstream Issue Drafts

> Drafted on 2026-05-06 from the forgets M0/M1 compatibility work. These are ready to copy into <https://github.com/PerryTS/perry/issues/new>. Direct submission was not possible from this workspace because GitHub requires sign-in and neither `gh` nor a GitHub token is available.

## Issue 1: Fastify reply.header(name, value) is not lowered to js_fastify_reply_header

Labels: bug, fastify, codegen

### Summary

`reply.header(name, value)` on the Fastify native path does not reliably emit response headers in a Perry-compiled executable. The runtime already contains `js_fastify_reply_header`, but the LLVM/native-module codegen dispatch table does not route the Fastify reply `header(name, value)` call to it.

### Environment

```txt
OS: Windows
Perry source build: 0.5.585
Perry commit tested: 9ac09171e17e7eec49e4c9d10054bf1ec2580d2a
npm @perryts/perry: 0.5.511
fastify: 5.8.5
LLVM/clang: 22.1.5
Linker: MSVC link.exe
```

### Reproduction

```ts
import fastify from "fastify";

const port = Number(process.argv[2] || 45401);
const app = fastify();

app.get("/status-header", async (_request, reply) => {
  reply.code(201);
  reply.header("x-mode", "native");
  reply.send({ created: true });
});

app.listen({ port, host: "0.0.0.0" }, () => {
  console.log("ready " + port);
});
```

```powershell
npm install fastify
perry compile server.ts -o server.exe
.\server.exe 45401
curl.exe -i http://127.0.0.1:45401/status-header
```

### Expected

The response includes the custom header:

```txt
HTTP/1.1 201 Created
x-mode: native
content-type: application/json; charset=utf-8
```

### Actual

The status and body can be correct, but the custom response header is not emitted.

### Investigation

The Perry runtime has a `js_fastify_reply_header` symbol, but `crates/perry-codegen/src/lower_call.rs` did not include a Fastify receiver method signature for `reply.header(name, value)`.

We were able to make the native smoke pass with a local source patch that:

```txt
adds NativeModSig:
  module: "fastify"
  has_receiver: true
  method: "header"
  runtime: "js_fastify_reply_header"
  args: [NA_JSV, NA_JSV]
  ret: NR_PTR

changes native_module_lookup to prefer signatures whose args.len() matches the call argument count
```

The argument-count selection matters because Fastify request and reply both expose a method named `header`:

```txt
request.header(name)
reply.header(name, value)
```

### Request

Please add an official Fastify reply-header native signature and overload selection for native module methods with the same name but different arity.

## Issue 2: Release channels are out of sync: npm latest is 0.5.511 while updater reports 0.5.585

Labels: bug, release, windows

### Summary

The package manager and Perry updater report different latest versions. This makes reproducible installation difficult for downstream frameworks that need a stable compiler baseline.

### Fresh evidence from 2026-05-06

```powershell
npm view @perryts/perry version
# 0.5.511

node_modules\.bin\perry.cmd --version
# perry 0.5.511

node_modules\.bin\perry.cmd update --check-only
# Update available: 0.5.511 -> 0.5.585
# Release: https://github.com/PerryTS/perry/releases/tag/v0.5.585
```

GitHub marks `v0.5.585` as the latest release, but npm still publishes `@perryts/perry@0.5.511`.

### Expected

One of these should be true:

```txt
npm @perryts/perry publishes the same latest version as the official release
or
the updater/docs clearly state that newer builds are source-build-only
or
the updater installs the exact release artifact for the current platform
```

### Actual

Downstream users can install only `0.5.511` through npm, while Perry itself reports `0.5.585` as available.

### Impact

Frameworks trying to support Perry need to choose between:

```txt
using reproducible npm installs on the older compiler
or
requiring a source-built Perry from GitHub main/release tags
```

That makes CI, documentation, issue reproduction, and user onboarding unstable.

### Request

Please publish the matching npm package/platform packages for the latest release, or document the intended installation/update path for Windows users and downstream framework authors.

## Issue 3: Hyper/raw HTTP server primitives are not exposed as a stable TypeScript server API

Labels: enhancement, http, stdlib

### Summary

Perry appears to contain a lower-level hyper/Tokio HTTP server implementation under `perry-stdlib/src/framework`, but the usable public server path is Fastify-backed. For framework authors who want a first-party no-Fastify Perry native HTTP driver, there does not appear to be a stable TypeScript module/API.

### Environment

```txt
Perry source build: 0.5.585
Perry commit tested: 9ac09171e17e7eec49e4c9d10054bf1ec2580d2a
OS: Windows
```

### What we tried

We experimented with direct raw declarations for symbols such as:

```txt
js_http_server_create
js_http_server_accept_v2
js_http_request_method
js_http_request_path
js_http_request_query
js_http_request_headers_all
js_http_request_body
js_http_respond_with_headers
```

Default compile failed at link time because auto-optimize rebuilt runtime+stdlib with no optional `http-server` feature enabled. Direct raw declarations do not map to the native-module import detection in `stdlib_features.rs`.

Using `--no-auto-optimize` allowed the binary to link, but the smoke server still timed out on a simple `/healthz` request.

### Expected

Perry should expose one stable TypeScript server API for the lower-level native HTTP path, for example a documented module import that:

```txt
enables the required stdlib feature during auto-optimize
avoids direct ABI-level js_http_* declarations from userland
supports method/path/query/headers/body/status/response headers
has a native smoke test in the Perry repository
```

### Actual

The practical server path for framework authors is Fastify-backed. The raw lower-level path is visible in Rust source but not usable as a stable TypeScript contract.

### Request

Please either expose/document a stable no-Fastify native HTTP server module, or explicitly document that Fastify is the only supported HTTP server path for now.

## Issue 4: Please document or improve Fastify native server request dispatch concurrency semantics

Labels: question, documentation, fastify, concurrency

### Summary

The Fastify-backed native server appears to process TypeScript route handlers serially on the Perry side. This may be intentional, but downstream frameworks need the concurrency semantics documented clearly.

### Environment

```txt
Perry source build: 0.5.585
Perry commit tested: 9ac09171e17e7eec49e4c9d10054bf1ec2580d2a
fastify: 5.8.5
OS: Windows
```

### Reproduction shape

```ts
import fastify from "fastify";

const app = fastify();
let slowStarted = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.get("/slow", async (_request, reply) => {
  slowStarted = true;
  await delay(500);
  reply.send({ marker: "slow" });
});

app.get("/slow-started", async (_request, reply) => {
  reply.send({ started: slowStarted });
});
```

Run `/slow`, then while it is pending call `/slow-started`.

### Expected, if route dispatch is concurrent

`/slow-started` can run while `/slow` is awaiting and returns:

```json
{"started":true}
```

### Actual observed in native smoke

`/slow-started` returned:

```json
{"started":false}
```

The slow request completed later. Our native result recorded:

```txt
ConcurrentDispatch=serial-observed
StateIsolation=not-observed
```

### Source-level observation

The Fastify-backed native server appears to queue HTTP requests through an mpsc channel to a TypeScript-side event loop. That loop handles one pending request and waits for the promise before receiving the next one.

### Request

Please clarify whether this serial TypeScript handler dispatch is the intended Fastify native behavior.

If it is intended, docs should say that HTTP accept/connection I/O may be native/async, but TypeScript handler dispatch is serialized.

If it is not intended, it would be useful to have a Perry-native concurrency model for route handlers or documented per-request isolation rules.
