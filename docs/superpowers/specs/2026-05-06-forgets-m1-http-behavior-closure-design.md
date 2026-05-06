# forgets M1 HTTP Behavior Closure Design

> Date: 2026-05-06

## Goal

Close the M1 HTTP behavior baseline so host tests and Perry native smoke both prove the response boundary that `forgets` already documents.

## Scope

This step stays inside M1. It does not start M2 static route scanning or M3 schema/OpenAPI work.

```txt
Cover route params, query, headers, and body together.
Cover undefined -> 204 and null -> JSON null.
Cover ctx.set() response headers.
Cover ResponseBuilder status/header/body normalization.
Cover throw HttpError and async rejection recovery.
Cover RequestScheduler busy 503 in native smoke.
Keep Fastify as hidden v1 transport substrate.
Keep ConcurrentDispatch=serial-observed for Perry Fastify-backed native dispatch.
```

## ResponseBuilder Decision

`Context.status(code)` returns a small mutable `ResponseBuilder`.

```ts
const response = ctx.status(201);
response.headers["x-mode"] = "native";
response.body = { created: true };
return response;
```

The normalizer treats this object as an explicit response:

```txt
status = response.statusCode
headers = response.headers plus inferred content-type for the body
body = normalized body content
```

`ctx.set(name, value)` remains a response-header side channel. Driver-level response headers override or extend normalized response headers after `normalizeResponse()` so middleware and handlers can set headers without constructing a ResponseBuilder.

## Native Smoke Decision

The M1 native smoke fixture adds narrow routes for the missing response boundary behaviors. The PowerShell smoke script checks these routes after the existing health/echo/middleware checks.

Request scheduling is tested with a second fixture server using `schedulerOptions: { maxConcurrentRequests: 0, requestQueueLimit: 0 }`. This proves `createNativeHttpDriver(app, { schedulerOptions })` can produce a structured `FORGETS_BUSY` 503 in a Perry native executable without changing the main smoke server's serial dispatch observation.

## Non-Goals

```txt
No chainable response helper API in this step.
No full Web Response compatibility.
No static route scanner changes.
No native graceful shutdown claim.
No claim that Perry Fastify-backed TS handlers dispatch concurrently.
```

## Verification

```txt
npm test -- packages/http/test/response.test.ts
npm test -- packages/runtime/test/driver.test.ts
npm run check
npm run m1:http
```

`.forgets/m1-http/results.json` must record the newly covered M1 behavior as passed and keep `ConcurrentDispatch=serial-observed`.
