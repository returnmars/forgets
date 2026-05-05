# Perry Compatibility Baseline

> M0 compatibility baseline for `forgets`. This file is a source-audit baseline, not a completed native compile/run report yet.

## Scope

```txt
Perry source: docs/perry-main-src/perry-main
Workspace version: 0.5.494
Status: source-audit baseline, native tests pending
```

Perry docs and Perry source can drift. `forgets` should treat source audit plus M0 native tests as the framework capability boundary.

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
```

Framework decision:

```txt
Default async, explicit parallelism.
I/O-bound handlers use async/await and do not expose Tokio to users.
CPU-bound handlers must use perry/thread spawn/parallelMap or a native package.
Do not promise automatic multi-core execution of every TS request handler.
Concurrent request behavior, request isolation, and CPU-bound blocking must be native-tested.
```

### Native Fastify

Perry has a native fastify stdlib path covering route registration, listen, request params/query/header/body, and reply status/send APIs.

Source:

```txt
docs/perry-main-src/perry-main/crates/perry-stdlib/src/fastify
docs/perry-main-src/perry-main/crates/perry-codegen/src/lower_call.rs
```

Source-audit risks:

```txt
bodyLimit must be tested at actual server body-read time
setErrorHandler/onError must be tested through request dispatch
undefined/null response behavior differs from forgets 204 semantics
request id should be generated by forgets
server.close/graceful close must be tested
```

Framework decision:

```txt
v1 can wrap Perry native fastify.
The public contract is forgets Context/Middleware/ResponseValue/Error.
recovery/body limit/request id/timeout/response normalization live in forgets.
```

---

## M0 Native Test Matrix

Add compile/run results here as tests are created.

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
M0-014 native fastify GET route
M0-015 native fastify path params/query/header/body
M0-016 native fastify JSON response/status/header
M0-017 undefined/null response baseline
M0-018 handler throw/rejection baseline
M0-019 bodyLimit baseline
M0-020 process.on signal/graceful shutdown baseline
M0-021 Promise.all async concurrency baseline
M0-022 perry/thread spawn baseline
M0-023 perry/thread parallelMap baseline
M0-024 native fastify concurrent requests baseline
M0-025 CPU-bound handler blocking/offload baseline
```

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
driver hidden behind @forgets/http
default async, explicit CPU parallelism
per-request Context isolation
Perry native smoke tests before production claims
```
