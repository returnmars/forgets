# Perry Compatibility Baseline

> Source-audit and native smoke baseline for `forgets`.

## Scope

```txt
Perry source: docs/perry-main-src/perry-main
Workspace version: 0.5.494
M0 CLI package: @perryts/perry 0.5.511
Tracked upstream source: .forgets/perry-github-main
Tracked upstream version: 0.5.585
Local source status: 0.5.585 plus Fastify reply.header codegen patch
Status: source-audit baseline plus M0/M1 native smoke evidence
```

Perry docs and Perry source can drift. `forgets` should treat source audit plus M0 native tests as the framework capability boundary.

### Perry 0.5.585 Source Build

As of 2026-05-06, `@perryts/perry` on npm still reports `latest: 0.5.511`. The Perry GitHub release page has `v0.5.585`, and `perry update --check-only` detects `0.5.511 -> 0.5.585`, but `perry update --force` cannot complete on Windows because the expected `perry-windows-x86_64.zip` binary asset is not available through the release API.

Local source tracking:

```txt
Local: .forgets/perry-github-main
Remote: https://github.com/PerryTS/perry.git
Commit: 9ac09171e17e7eec49e4c9d10054bf1ec2580d2a
Commit date: 2026-05-06 07:55:58 +0200
Commit subject: docs(benchmarks): refresh Perry numbers for v0.5.585 fast-math opt-in
Workspace version: 0.5.585
```

Source build evidence:

```txt
cargo build --release -p perry
cargo build --release -p perry-runtime -p perry-stdlib -p perry-ui-windows
.forgets/perry-github-main/target/release/perry.exe --version
perry 0.5.585
```

Local source patch evidence:

```txt
.forgets/perry-github-main/crates/perry-codegen/src/lower_call.rs
.forgets/perry-github-main/crates/perry-codegen/src/lower_call/native.rs
```

The source-built Perry used by M1 carries a small local codegen patch for Fastify response headers:

```txt
add fastify reply.header(name, value) -> js_fastify_reply_header
select native module overloads by argument count before falling back to the first candidate
```

The upstream runtime already contains `js_fastify_reply_header`, but the checked codegen table did not route the npm Fastify reply `header(name, value)` method to it. Fastify request `header(name)` and reply `header(name, value)` share the same method name, so argument-count-aware native lookup is needed for this path. Until upstream includes an equivalent fix, custom response headers in the M1 native smoke require this source-built Perry baseline rather than stock npm `@perryts/perry 0.5.511`.

Doctor evidence with source-built libraries:

```txt
PERRY_RUNTIME_DIR=.forgets/perry-github-main/target/release
PERRY_LIB_DIR=.forgets/perry-github-main/target/release
perry doctor
OK perry version: 0.5.585
OK clang (LLVM codegen)
OK system linker (MSVC link.exe)
OK runtime library: .forgets/perry-github-main/target/release/perry_runtime.lib
WARN project config (perry.toml): not found
```

Decision:

```txt
Keep package.json on npm Perry 0.5.511 for reproducible installs.
Use source-built Perry 0.5.585 through PERRY/PERRY_RUNTIME_DIR/PERRY_LIB_DIR for research and compatibility probes.
Do not claim the project has upgraded its npm dependency to 0.5.585 until npm publishes that version.
```

---

## Source-Audited Constraints

### Decorators

Perry HIR lowering rejects TypeScript decorators:

```txt
class decorators
method decorators
property decorators
private method/property decorators
constructor parameter decorators
method parameter decorators
```

Source:

```txt
docs/perry-main-src/perry-main/crates/perry-hir/src/lower_decl.rs
```

Framework decision:

```txt
No Router Decorator.
No @Controller/@Get/@Post/@Injectable/@Inject/@Module.
No DI based on constructor parameter metadata.
```

### Reflect / Metadata

Perry source has partial lowering/codegen/runtime branches for `Reflect.*`, `Proxy`, `Symbol`, and `Object.defineProperty`. That is not the same as decorator metadata support.

Source:

```txt
docs/perry-main-src/perry-main/crates/perry-hir/src/lower/expr_call.rs
docs/perry-main-src/perry-main/crates/perry-codegen/src/expr.rs
docs/perry-main-src/perry-main/crates/perry-runtime/src/proxy.rs
docs/perry-main-src/perry-main/crates/perry-runtime/src/object.rs
docs/perry-main-src/perry-main/crates/perry-runtime/src/symbol.rs
```

Framework decision:

```txt
Partial Reflect/Proxy/Symbol support may exist.
Do not build routing, schema, DI, parameter injection, or OpenAPI on Reflect/metadata.
```

### Dynamic Import

Dynamic `import()` still has an incomplete-support warning path in HIR lowering.

Source:

```txt
docs/perry-main-src/perry-main/crates/perry-hir/src/lower/expr_call.rs
```

Framework decision:

```txt
Do not depend on dynamic import() for route discovery.
Use explicit entries and static route scanning in forgets build.
```

### Compile / Check

`perry compile` takes a single `.ts` entry. Perry then gathers dependencies from that entry. `perry check` can verify parsing, HIR lowering, and some dependency behavior, but it does not replace final codegen/link/native smoke tests.

Source:

```txt
docs/perry-main-src/perry-main/crates/perry/src/commands/compile.rs
docs/perry-main-src/perry-main/crates/perry/src/commands/check.rs
```

Framework decision:

```txt
forgets build generates .forgets/perry-entry.generated.ts.
perry check is a preflight check only.
Release requires successful perry compile.
```

### Abort / Signals

`AbortController` and `AbortSignal` have source implementations. `AbortSignal.timeout(ms)` currently returns a signal that must be native-tested for real timer behavior.

`process.on("exit", handler)` has source comments indicating callbacks are stored but do not fire on real process exit. `SIGTERM` and `SIGINT` cannot be assumed to provide Node.js style graceful shutdown semantics.

Source:

```txt
docs/perry-main-src/perry-main/crates/perry-runtime/src/url.rs
docs/perry-main-src/perry-main/crates/perry-runtime/src/os.rs
```

Framework decision:

```txt
timeout v1 returns a timeout response.
timeout v1 does not promise cancellation of in-flight IO.
graceful shutdown requires a dedicated native test.
```

### Async / Concurrency

Perry uses a Tokio-backed bridge for native async stdlib operations, but TS code should not be described as automatically running every handler on Tokio worker threads.

Source:

```txt
docs/perry-main-src/perry-main/docs/native-libraries.md
docs/perry-main-src/perry-main/docs/src/language/supported-features.md
docs/perry-main-src/perry-main/crates/perry-stdlib/src/common/async_bridge.rs
docs/perry-main-src/perry-main/crates/perry-runtime/src/promise.rs
docs/perry-main-src/perry-main/crates/perry-runtime/src/thread.rs
docs/perry-main-src/perry-main/crates/perry-stdlib/src/framework/server.rs
```

Source-audited facts:

```txt
perry-stdlib has a global Tokio runtime for async native work.
Promise completions are queued back to the Perry main-thread pump.
Complex JSValue creation from async results is deferred to the main thread.
perry/thread spawn and parallelMap use real OS threads with serialized/deep-copied values.
The low-level HTTP server uses hyper + tokio for accept/connection I/O.
The Fastify-backed native server queues HTTP requests through an mpsc channel to a TS-side event_loop.
That event_loop handles one pending request at a time and wait_for_promise blocks before the next request is received.
```

Framework decision:

```txt
Default async, explicit parallelism.
I/O-bound handlers use async/await and do not expose Tokio to users.
CPU-bound handlers must use perry/thread spawn/parallelMap or a native package.
Do not promise automatic multi-core execution of every TS request handler.
M1 currently records Fastify-backed TS route dispatch as serial-observed.
Concurrent request behavior under a future concurrent TS dispatch model, request isolation, and CPU-bound blocking must be native-tested.
```

### First-party Native HTTP

As of 2026-05-06, the checked local package is `@perryts/perry 0.5.511`. Public GitHub `PerryTS/perry` main was also checked and source-built at commit `9ac09171e17e7eec49e4c9d10054bf1ec2580d2a` (`2026-05-06 07:55:58 +0200`, workspace version `0.5.585`).

The current upstream public server path is Fastify-backed:

```txt
crates/perry-ext-fastify
test-files/test_fastify_integration.ts
docs/examples/stdlib/http/snippets.ts
```

Perry also has `crates/perry-ext-http`, but that extension targets Node `http`/`https` client-style APIs, not the first-party no-Fastify server driver that forgets needs.

There is still a lower-level hyper-based HTTP server under `crates/perry-stdlib/src/framework`. It accepts connections with Tokio/hyper, passes pending requests through a channel to the TS side, and waits for a response channel to write back. Upstream Cargo feature comments keep this path for non-Fastify hyper users, but the request/response/server framework files currently show no meaningful coverage in the checked coverage reports.

Directly declaring raw `js_http_*` symbols from TypeScript is not a stable API in `@perryts/perry 0.5.511` or source-built `0.5.585`. In `0.5.585`, `runtime_decls.rs` declares the raw HTTP server symbols and `perry-stdlib/src/framework` still exports them behind the `http-server` feature, but auto-optimize only enables stdlib features detected from native module imports. A direct `declare function js_http_*` path does not register any native module import, so the `0.5.585` default compile rebuilds stdlib with no optional features and fails to link these symbols.

Forced full-stdlib compile with `--no-auto-optimize` proves the symbols can link, but the smoke server still times out on `/healthz`. That keeps the earlier ABI/runtime conclusion: raw `js_http_*` direct declarations are not a usable framework contract.

Source:

```txt
docs/perry-main-src/perry-main/crates/perry-stdlib/src/lib.rs
docs/perry-main-src/perry-main/crates/perry-stdlib/src/framework/server.rs
docs/perry-main-src/perry-main/crates/perry-stdlib/src/framework/request.rs
docs/perry-main-src/perry-main/crates/perry-stdlib/src/framework/response.rs
docs/perry-main-src/perry-main/crates/perry-stdlib/Cargo.toml
docs/perry-main-src/perry-main/crates/perry-codegen/src/lower_call.rs
docs/perry-main-src/perry-main/crates/perry-codegen/src/runtime_decls.rs
docs/perry-main-src/perry-main/crates/perry/src/commands/stdlib_features.rs
docs/perry-main-src/perry-main/crates/perry/src/commands/compile/optimized_libs.rs
https://github.com/PerryTS/perry/tree/main/crates/perry-ext-fastify
https://github.com/PerryTS/perry/tree/main/crates/perry-ext-http
https://github.com/PerryTS/perry/blob/main/test-files/test_fastify_integration.ts
https://github.com/PerryTS/perry/blob/main/docs/examples/stdlib/http/snippets.ts
```

Source-audit risks:

```txt
Official upstream server example currently uses Fastify
no-Fastify raw server API is not exposed as a stable TypeScript module
direct js_http_* declarations are ABI-unsafe in Perry 0.5.511
direct js_http_* declarations are not auto-optimize-visible in source-built Perry 0.5.585
hyper-based framework primitives need upstream API/ABI work before production use
Fastify-backed native TS route handlers are currently processed serially by the Perry event_loop
bodyLimit must be enforced by the forgets adapter/driver, regardless of the underlying transport
undefined/null response behavior must be normalized by forgets
HttpError normalization must use a shape guard, not only instanceof, because native smoke exposed HttpError-shaped values that did not satisfy instanceof
request id should be generated by forgets
close/graceful close must be implemented and native-tested by forgets
request queue/backpressure/max concurrency must be explicit forgets behavior
```

Framework decision:

```txt
v1 default native HTTP path wraps Perry's official Fastify-compatible server support inside @forgets/runtime.
Do not expose Fastify as the public framework API or plugin/hook contract.
Do not reintroduce a private @forgets/perry-http-core Rust shim as the production path.
forgets should keep a first-party Perry-native HTTP driver contract in TypeScript.
Raw no-Fastify transport remains experimental until Perry exposes a stable TypeScript module or the upstream stdlib/FFI/codegen path is fixed.
M1 native HTTP smoke uses the Fastify-backed path.
The public contract is forgets Context/Middleware/ResponseValue/Error.
recovery/body limit/request id/timeout/request scheduling/response normalization live in the forgets adapter, not in Fastify plugins.
RequestScheduler owns forgets admission/backpressure policy: active request limit, FIFO queue, queue timeout, and structured FORGETS_BUSY 503 responses.
This scheduler does not change the current Fastify-backed native observation that Perry processes TS route dispatch serially.
```

Current 0.5.585 Fastify-backed native evidence:

```txt
Command: npm run m1:http
Perry: source-built .forgets/perry-github-main/target/release/perry.exe 0.5.585
Environment: PERRY_RUNTIME_DIR/PERRY_LIB_DIR=.forgets/perry-github-main/target/release
Host Fastify dependency: fastify 5.8.5
Result: perry check passed, perry compile passed, native run passed.
Smoke: GET /healthz, POST /echo, path params, undefined 204, null JSON, explicit status/header/body, HttpError, async rejection, request id, recovery, body limit, timeout, access log, and scheduler busy passed.
Concurrent probe: slow async route completes, but /slow-started cannot observe it while pending; ConcurrentDispatch=serial-observed and StateIsolation=not-observed.
Host tests cover RequestScheduler admission behavior and Fastify driver busy 503 normalization.
Runtime driver note: writeFastifyResponse materializes normalized headers before calling reply.header(), because native smoke exposed a Perry boundary where direct iteration over the normalized header object did not reliably emit custom headers.
Artifact: .forgets/m1-http/results.json records Healthz=passed, Echo=passed, Params=passed, Undefined=passed, Null=passed, StatusHeader=passed, HttpError=passed, AsyncRejection=passed, RequestId=passed, Recovery=passed, BodyLimit=passed, Timeout=passed, AccessLog=passed, SchedulerBusy=passed, ConcurrentDispatch=serial-observed, and StateIsolation=not-observed.
Server log: "forgets ready port=<port>" and "Server listening on http://0.0.0.0:<port>".
Audit: npm audit --omit=dev found 0 vulnerabilities after upgrading Fastify to 5.8.5.
```

Raw `js_http_*` experiment evidence:

```txt
Default compile failed at link with unresolved js_http_server_create, js_http_server_accept_v2, js_http_request_method, js_http_request_path, js_http_request_query, js_http_request_headers_all, js_http_request_body, js_http_respond_with_headers.
Root cause: auto-optimize rebuilt runtime+stdlib with features=(no optional features), because direct raw declarations do not map to stdlib_features.rs module imports.
Control compile with --no-auto-optimize succeeded and produced native-http-smoke-full.exe.
Control run printed "forgets ready port=<port>", but curl /healthz timed out after 2 seconds.
```

### Official Examples

The official examples repository was cloned for local reference:

```txt
Local: .forgets/perry-examples
Remote: https://github.com/PerryTS/perry-examples
Checked commit: 88894791bb9b721ff516910e3c481d2510c8a1c6
Commit date: 2026-04-30 17:49:36 +0200
```

The examples are standalone app compatibility samples. They cover Express/PostgreSQL, Fastify/Redis/MySQL, Hono/MongoDB, Koa/Redis, NestJS/TypeORM, Next.js/Prisma, and a blockchain/library compatibility demo. The README instructs users to enter one subdirectory, install dependencies, and run `perry build src/index.ts -o server`.

Framework decision:

```txt
Use perry-examples as ecosystem compatibility reference.
Do not copy its package.json files as forgets production defaults.
Do not treat its framework examples as the forgets runtime contract.
Fastify can be used as the v1 Perry-native transport substrate, but only behind the forgets runtime adapter.
```

---

## M0 Native Test Matrix

Add compile/run results here as tests are created.

Seed runner contract:

```txt
scripts/forgets-m0.ps1 writes .forgets/m0/results.json.
Positive cases must record check, compile, and native run.
Expected-negative cases may record expected-failure and skip compile/run.
If perry is missing, record not-run rows and the install guidance.
Each case is copied into an isolated .forgets/m0/work/<run>/<case> directory before check/compile, because Perry check may otherwise scan sibling fixtures in the same input directory.
Native HTTP rows stay deferred until the first-party @forgets/runtime driver exists.
```

```txt
M0-001 decorators should fail at lowering
M0-002 static class/private fields/methods compile and run
M0-003 async/await/Promise compile and run
M0-004 JSON parse/stringify compile and run
M0-005 Map/Set compile and run
M0-006 Uint8Array/TextEncoder/TextDecoder compile and run
M0-007 process.env works in native binary
M0-008 timer setTimeout/clearTimeout semantics
M0-009 AbortController.abort listener semantics
M0-010 AbortSignal.timeout real timer semantics
M0-011 dynamic import is rejected or returns unsupported result
M0-012 perry check generated entry
M0-013 perry compile generated entry
M0-014 first-party native HTTP GET route
M0-015 first-party native HTTP path params/query/header/body
M0-016 first-party native HTTP JSON response/status/header
M0-017 undefined/null response baseline
M0-018 handler throw/rejection baseline
M0-019 bodyLimit baseline
M0-020 process.on signal/graceful shutdown baseline
M0-021 Promise.all async concurrency baseline
M0-022 perry/thread spawn baseline
M0-023 perry/thread parallelMap baseline
M0-024 first-party native HTTP concurrent requests baseline
M0-025 CPU-bound handler blocking/offload baseline
```

## M0 Results

Last attempted run:

```txt
Command: npm run m0
Perry: source-built .forgets/perry-github-main/target/release/perry.exe 0.5.585
Environment: PERRY_RUNTIME_DIR/PERRY_LIB_DIR=.forgets/perry-github-main/target/release
Result: expected decorator failure plus four positive check/compile/run cases passed.
Doctor: source-built perry doctor reports all critical checks passed; project config perry.toml is still only a warning.
Artifact: .forgets/m0/results.json was written with per-case check/compile output.
```

| Case | Check | Compile | Run | Notes |
| --- | --- | --- | --- | --- |
| decorators-fail | expected-failure | skipped | skipped | Perry rejects decorators with U006 |
| basic-runtime | passed | passed | passed | Output recorded class/private/TextEncoder/Map/Promise behavior |
| async-concurrency | passed | passed | passed | Output recorded Promise.all/timer async behavior |
| thread-spawn | passed | passed | passed | Output recorded perry/thread spawn and parallelMap behavior |
| abort-timeout | passed | passed | passed | check/compile pass with AbortSignal warning; output recorded abort listener and timeout initial state |
| native-http-smoke | deferred | deferred | deferred | Minimal Fastify-backed smoke is tracked under M1; expanded behavior suite remains follow-up |
| native-http-concurrent | deferred | deferred | deferred | Requires first-party driver follow-up plus parallel client requests |

---

## M1 HTTP Results

Latest run:

```txt
Command: npm run m1:http
Perry: source-built .forgets/perry-github-main/target/release/perry.exe 0.5.585
Environment: PERRY_RUNTIME_DIR/PERRY_LIB_DIR=.forgets/perry-github-main/target/release
Result: perry check passed; perry compile passed; native run passed.
Smoke: GET /healthz, POST /echo, path params, undefined 204, null JSON, explicit status/header/body, HttpError, async rejection, request id, recovery, body limit, timeout, access log, and scheduler busy passed.
Concurrent probe: Fastify-backed native TS route dispatch is serial-observed; true concurrent TS route state isolation is not-observed.
Request admission: @forgets/runtime routes Fastify-backed handlers through RequestScheduler for maxConcurrentRequests/requestQueueLimit/queueTimeoutMs and structured FORGETS_BUSY 503 responses.
Response headers: custom status/header/body responses pass on source-built Perry 0.5.585 plus the local Fastify reply.header codegen patch.
Artifact: .forgets/m1-http/results.json records Check=passed, Compile=passed, Run=passed, Healthz=passed, Echo=passed, Params=passed, Undefined=passed, Null=passed, StatusHeader=passed, HttpError=passed, AsyncRejection=passed, RequestId=passed, Recovery=passed, BodyLimit=passed, Timeout=passed, AccessLog=passed, SchedulerBusy=passed, ConcurrentDispatch=serial-observed, and StateIsolation=not-observed.
```

| Case | Check | Compile | Run | Notes |
| --- | --- | --- | --- | --- |
| native-http-smoke | passed | passed | passed | Fastify-backed `createNativeHttpDriver(app).listen(port)`; `/healthz`, `/echo`, params, undefined/null, status/header/body, HttpError, async rejection, request id, recovery, body limit, timeout, access log, and scheduler busy passed; concurrent TS route dispatch recorded as serial-observed |
| raw native-http-smoke | passed | failed | not-run | historical `js_http_*` experiment; unresolved with auto-optimize features=(no optional features) |
| raw native-http-smoke --no-auto-optimize | not-scripted | passed | failed | historical control; full stdlib links, server starts, `/healthz` times out |

---

## Design Impact

Keep these decisions unless M0 proves a stronger Perry contract:

```txt
explicit RouteDefinition values
static route factory subset
schema-first runtime boundaries
no decorator metadata
no reflection DI
single generated Perry entry
first-party driver hidden behind @forgets/http
default async, explicit CPU parallelism
per-request Context isolation
no public claim of concurrent TS route execution on the current Fastify-backed native path
Perry native smoke tests before production claims
```
