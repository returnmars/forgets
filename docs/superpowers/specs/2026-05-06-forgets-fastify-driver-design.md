# forgets Fastify Driver Design

> Date: 2026-05-06

## Goal

Use Perry's official Fastify-compatible server path as the default native HTTP driver for `forgets`, while keeping the public `@forgets/http` API stable.

## Decisions

```txt
@forgets/http remains the public user-facing API.
@forgets/runtime maps inspected forgets routes onto Fastify.
createNativeHttpDriver(app) becomes the default Fastify-backed native driver.
raw js_http_* transport remains experimental and is not the M1 release path.
M1 native smoke must compile and run through Fastify.
```

## Architecture

The runtime owns the adapter from forgets `App` to Fastify. It registers every inspected route with Fastify, builds a forgets `Context` from `request.method`, `request.url`, `request.headers`, `request.query`, and `request.rawBody`, then normalizes the handler return value through the existing `normalizeResponse` function before writing status, headers, and body to Fastify's reply.

Perry native Fastify recognition is shape-sensitive. The `listen()` path follows the official callback-style `server.listen({ port, host }, () => ...)` pattern and captures request fields inside inline route handlers before crossing into shared forgets helpers. Host-side `buildServer()` may use shared helpers because it runs through normal Fastify `inject()` rather than Perry native lowering.

The existing transport-based driver is retained for host-side unit tests and future raw-driver experiments. It is no longer the default path used by `createNativeHttpDriver`.

## Testing

Host tests use Fastify's `inject()` API to verify route dispatch and response normalization without opening a socket. M1 native smoke compiles and runs a real Perry executable, curls `/healthz` and `/echo`, and treats Fastify as the native server surface.

## Dependency Rule

Use Fastify `^5.8.5` for host-side dependency resolution. Fastify 4.x currently leaves a high-severity npm audit finding whose available fix is Fastify 5.8.5, and the Fastify 5 dependency line has passed both host tests and the Perry M1 native smoke.

Do not expose Fastify 5 plugin/hook compatibility as a forgets promise. The compatibility gate is the forgets behavior suite plus Perry native smoke, not upstream example version drift.
