# forgets Request Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-party request scheduler for runtime admission control, queueing, and busy responses.

**Architecture:** Implement a transport-independent scheduler in `packages/runtime/src/scheduler.ts`, then route Fastify-backed driver handler execution through it. Keep response normalization in the driver and keep native M1 concurrency evidence as `serial-observed`.

**Tech Stack:** TypeScript, Vitest, Perry M1 native smoke.

---

## File Structure

```txt
packages/runtime/src/scheduler.ts
  RequestScheduler, scheduler options, busy HttpError creation, FIFO queue.

packages/runtime/src/index.ts
  Public exports for scheduler types and constructors.

packages/runtime/src/driver.ts
  Fastify-backed driver integration with optional scheduler/schedulerOptions.

packages/runtime/test/scheduler.test.ts
  Focused scheduler unit tests.

packages/runtime/test/driver.test.ts
  Fastify inject tests proving driver routes through scheduler and returns 503 when busy.

docs/forgets-server-design.md
  Request admission policy note.

docs/perry-compat.md
  Keep native serial dispatch evidence aligned with scheduler semantics.
```

### Task 1: Scheduler Core

**Files:**
- Create: `packages/runtime/src/scheduler.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/scheduler.test.ts`

- [x] Write failing tests for immediate run, FIFO queue, full queue rejection, queue timeout, and rejection slot release.
- [x] Run `npm test -- packages/runtime/test/scheduler.test.ts` and verify it fails because scheduler does not exist.
- [x] Implement `RequestScheduler`, `createRequestScheduler`, `RequestSchedulerOptions`, `ResolvedRequestSchedulerOptions`, and `defaultRequestSchedulerOptions`.
- [x] Run `npm test -- packages/runtime/test/scheduler.test.ts` and verify it passes.

### Task 2: Fastify Driver Integration

**Files:**
- Modify: `packages/runtime/src/driver.ts`
- Modify: `packages/runtime/test/driver.test.ts`

- [x] Add failing tests proving Fastify driver executes handlers through a provided scheduler and returns structured `FORGETS_BUSY` 503 when the scheduler rejects.
- [x] Run `npm test -- packages/runtime/test/driver.test.ts` and verify the new tests fail.
- [x] Add `RuntimeHttpDriverOptions` with `scheduler` and `schedulerOptions`.
- [x] Wrap `inspected.handler(ctx)` in `scheduler.run(() => inspected.handler(ctx))`.
- [x] Run `npm test -- packages/runtime/test/driver.test.ts` and verify it passes.

### Task 3: Documentation And Native Verification

**Files:**
- Modify: `docs/forgets-server-design.md`
- Modify: `docs/perry-compat.md`
- Reference: `scripts/forgets-m1-http.ps1`

- [x] Update docs to describe request admission as forgets runtime policy.
- [x] Keep Perry Fastify-backed native TS route dispatch documented as `serial-observed`.
- [x] Run `npm run check`.
- [x] Run `npm run m1:http`.
- [x] Confirm `.forgets/m1-http/results.json` still records `ConcurrentDispatch=serial-observed`.

## Self-Review

```txt
Scheduler has no Fastify dependency.
Driver response normalization remains centralized.
Busy responses use HttpError and normalize to {"error":{...}}.
Current Perry native limitations remain documented.
No public claim says the current Fastify-backed native path runs TS handlers concurrently.
```
