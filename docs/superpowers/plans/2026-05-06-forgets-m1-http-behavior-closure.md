# forgets M1 HTTP Behavior Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and finish the M1 HTTP response boundary in host tests and Perry native smoke.

**Architecture:** Keep response normalization in `@forgets/http`, request context creation in `@forgets/runtime`, and native behavior evidence in `scripts/forgets-m1-http.ps1`. Add only the smallest ResponseBuilder support needed for explicit status/header/body responses.

**Tech Stack:** TypeScript, Vitest, PowerShell native smoke, PerryTS source-built/native compile.

---

## File Structure

```txt
packages/http/src/response.ts
  Detect ResponseBuilder and normalize status, headers, body, and content-type.

packages/http/test/response.test.ts
  Host response boundary tests for null and ResponseBuilder.

packages/runtime/test/driver.test.ts
  Fastify inject tests for params, ctx.set headers, undefined/null, HttpError, and async rejection.

test-files/forgets-m1/native-http-smoke.ts
  Native fixture routes for M1 behavior closure plus scheduler busy fixture mode.

scripts/forgets-m1-http.ps1
  Native assertions for params/status/header/null/undefined/HttpError/async rejection/scheduler busy.

docs/perry-compat.md
  Record expanded M1 behavior evidence after native verification.
```

### Task 1: Response Normalization

**Files:**
- Modify: `packages/http/test/response.test.ts`
- Modify: `packages/http/src/response.ts`

- [x] Add failing tests:

```ts
it("maps null to JSON null", () => {
  expect(normalizeResponse(null)).toEqual({
    status: 200,
    headers: { "content-type": "application/json" },
    body: "null",
  });
});

it("maps ResponseBuilder to explicit status, headers, and JSON body", () => {
  expect(normalizeResponse({
    statusCode: 201,
    headers: { "x-mode": "native" },
    body: { created: true },
  })).toEqual({
    status: 201,
    headers: {
      "content-type": "application/json",
      "x-mode": "native",
    },
    body: "{\"created\":true}",
  });
});
```

- [x] Run `npm test -- packages/http/test/response.test.ts`; expected red: ResponseBuilder is currently treated as a normal JSON object.
- [x] Implement `isResponseBuilder()` and ResponseBuilder normalization in `packages/http/src/response.ts`.
- [x] Run `npm test -- packages/http/test/response.test.ts`; expected green.

### Task 2: Runtime Driver Behavior

**Files:**
- Modify: `packages/runtime/test/driver.test.ts`

- [x] Add failing or guarding Fastify inject tests for params, `ctx.set()` header, undefined 204, null JSON response, thrown `HttpError`, and async rejection recovery.
- [x] Run `npm test -- packages/runtime/test/driver.test.ts`; expected red only for behaviors not already implemented.
- [x] If a behavior is red, implement the minimal runtime/http change that makes it pass.
- [x] Run `npm test -- packages/runtime/test/driver.test.ts`; expected green.

### Task 3: Native Fixture Routes

**Files:**
- Modify: `test-files/forgets-m1/native-http-smoke.ts`

- [x] Add native routes:

```ts
app.get("/users/:id", (ctx) => ({ id: ctx.params.id }));
app.get("/undefined", () => undefined);
app.get("/null", () => null);
app.get("/status-header", (ctx) => {
  ctx.set("x-mode", "native");
  const response = ctx.status(201);
  response.headers["x-route"] = "status";
  response.body = { created: true };
  return response;
});
app.get("/http-error", () => {
  throw HttpError.badRequest("Bad Native Request", { code: "BAD_NATIVE" });
});
app.get("/async-rejection", async () => {
  await Promise.resolve();
  throw new Error("async boom");
});
```

- [x] Add a busy fixture mode that starts only a `/busy` route with `createNativeHttpDriver(app, { schedulerOptions: { maxConcurrentRequests: 0, requestQueueLimit: 0 } })`.

### Task 4: Native Smoke Assertions

**Files:**
- Modify: `scripts/forgets-m1-http.ps1`

- [x] Add result fields for `Params`, `Undefined`, `Null`, `StatusHeader`, `HttpError`, `AsyncRejection`, and `SchedulerBusy`.
- [x] Add curl assertions for the new main fixture routes.
- [x] Start a second native process with the busy fixture argument and assert `/busy` returns structured `FORGETS_BUSY` 503.
- [x] Keep the existing slow/fast probe and `serial-observed` branch intact.

### Task 5: Documentation And Verification

**Files:**
- Modify: `docs/perry-compat.md`
- Modify: `docs/superpowers/plans/2026-05-06-forgets-m1-http-behavior-closure.md`

- [x] Run `npm run check`; expected green.
- [x] Run `npm run m1:http`; expected green.
- [x] Read `.forgets/m1-http/results.json` and confirm new fields are passed and `ConcurrentDispatch=serial-observed`.
- [x] Update `docs/perry-compat.md` with the expanded M1 evidence.
- [x] Mark this plan's completed checkboxes.

## Self-Review

```txt
Scope remains M1 HTTP behavior closure.
No static route scanner changes.
No Fastify public API exposure.
ResponseBuilder support is minimal and explicit.
Native smoke remains the release evidence source.
Custom response headers currently rely on the local source-built Perry Fastify reply.header codegen patch.
```
