# forgets Production Middleware Seed Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for this seed, and use superpowers:test-driven-development for behavior changes.

**Goal:** Add the first production middleware package and make `app.use()` participate in real request dispatch.

**Architecture:** Keep middleware as plain `Middleware = (next) => handler` values from `@forgets/http`. `@forgets/http` owns middleware composition in `App.inspectRoutes()`, so both the Fastify-backed driver and raw transport driver receive the already-composed route handler. `@forgets/middleware` provides small first-party values that depend only on the public HTTP contract.

**Tech Stack:** TypeScript, Vitest, Perry M1 smoke through the existing Fastify-backed runtime driver.

---

### Task 1: Dispatch Composition

**Files:**
- Modify: `packages/http/src/app.ts`
- Modify: `packages/http/test/app.test.ts`
- Modify: `packages/runtime/src/driver.ts`
- Modify: `packages/runtime/src/raw-driver.ts`

- [x] Add a failing test proving global `app.use()` and route-level middleware wrap route handlers in order.
- [x] Add `handler` to `InspectedRoute` and compose global plus route middleware in `inspectRoutes()`.
- [x] Update runtime drivers to call `inspected.handler(ctx)`.
- [x] Run `npm test -- packages/http/test/app.test.ts packages/middleware/test/middleware.test.ts`.

### Task 2: Middleware Package Seed

**Files:**
- Create: `packages/middleware/src/index.ts`
- Create: `packages/middleware/src/request-id.ts`
- Create: `packages/middleware/src/recovery.ts`
- Create: `packages/middleware/src/timeout.ts`
- Create: `packages/middleware/src/body-limit.ts`
- Create: `packages/middleware/src/access-log.ts`
- Create: `packages/middleware/test/middleware.test.ts`

- [x] Add `requestId()` with deterministic generator injection for tests.
- [x] Add `recovery()` for unexpected `Error` and preserved `HttpError`.
- [x] Add `timeout()` as a response boundary, without claiming underlying I/O cancellation.
- [x] Add `bodyLimit()` for content-length and first body read checks.
- [x] Add `accessLog()` with injectable clock and sink.
- [x] Run focused middleware tests.

### Task 3: Verification

- [x] Run `npm run check`.
- [x] Run `npm run m1:http`.

### Task 4: M1 Native Behavior Suite

**Files:**
- Modify: `scripts/forgets-m1-http.ps1`
- Modify: `test-files/forgets-m1/native-http-smoke.ts`
- Modify: `docs/perry-compat.md`

- [x] Extend M1 smoke script to assert request id, recovery, body limit, timeout, and access log behavior in the native executable.
- [x] Confirm the expanded suite fails before the native fixture exposes those routes.
- [x] Add the production middleware chain to the native M1 fixture.
- [x] Adjust `timeout()` race ordering so Perry native timers can win the response boundary.
- [x] Record expanded M1 results in the Perry compatibility baseline.

### Task 5: M1 Concurrent Dispatch Probe

**Files:**
- Modify: `scripts/forgets-m1-http.ps1`
- Modify: `test-files/forgets-m1/native-http-smoke.ts`
- Modify: `packages/http/src/error.ts`
- Modify: `packages/http/src/response.ts`
- Modify: `packages/http/src/index.ts`
- Modify: `packages/http/test/response.test.ts`
- Modify: `packages/middleware/src/recovery.ts`
- Modify: `packages/middleware/src/body-limit.ts`
- Modify: `packages/middleware/src/access-log.ts`
- Modify: `packages/runtime/src/driver.ts`
- Modify: `docs/perry-compat.md`

- [x] Add a slow/fast native probe to observe whether a second TS route can run while a slow async route is pending.
- [x] Confirm the probe fails before the native fixture exposes `/slow`, `/slow-started`, and `/fast`.
- [x] Add the fixture routes and fix PowerShell background curl output capture for paths containing spaces.
- [x] Add `isHttpError()` shape detection after native smoke exposed Perry `instanceof HttpError` instability.
- [x] Record the current Perry Fastify-backed result as `ConcurrentDispatch=serial-observed` and `StateIsolation=not-observed`.

### Follow-Up Boundaries

```txt
Native behavior suite covers request id, recovery, timeout response, body limit, and access log.
Concurrent dispatch probe exists and currently records serial TS route dispatch in Perry's Fastify-backed native path.
Do not claim concurrent TS route execution or per-request state isolation under true concurrent TS dispatch yet.
Timeout v1 only races the response boundary; it does not cancel in-flight handler or lower-level socket I/O.
bodyLimit v1 guards content-length and first body read; streaming body enforcement remains a follow-up.
```
