# forgets Fastify Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fastify the default Perry-native HTTP driver for `forgets`.

**Architecture:** Keep `@forgets/http` stable and adapt its inspected route list into Fastify in `@forgets/runtime`. Preserve the existing raw transport code as an experimental path, but route `createNativeHttpDriver(app)` to Fastify.

**Tech Stack:** TypeScript, Fastify 5.x, Vitest, Perry native smoke scripts.

---

### Task 1: Fastify Driver Tests

**Files:**
- Modify: `packages/runtime/test/driver.test.ts`

- [x] Add host-side tests that create a Fastify-backed driver, call `buildServer()`, and verify `inject()` for `GET /healthz`, `POST /echo?name=Ada`, and 404 normalization.
- [x] Run `npm test -- packages/runtime/test/driver.test.ts` and confirm the new tests fail because the Fastify driver API is not implemented yet.

### Task 2: Fastify Dependency And Runtime Driver

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/runtime/src/driver.ts`

- [x] Install `fastify@^5.8.5`.
- [x] Add `createFastifyHttpDriver(app)` and make `createNativeHttpDriver(app)` delegate to it by default.
- [x] Keep the existing transport driver available as `createTransportHttpDriver(app, options)` for raw experiments and unit tests.
- [x] Run `npm test -- packages/runtime/test/driver.test.ts` and confirm the driver tests pass.

### Task 3: M1 Smoke

**Files:**
- Modify: `test-files/forgets-m1/native-http-smoke.ts`
- Modify: `scripts/forgets-m1-http.ps1`

- [x] Update the smoke entry to call the Fastify-backed native driver.
- [x] Keep the script's `PERRY` override support.
- [x] Run `npm run m1:http` with the selected Perry CLI and confirm `/healthz` and `/echo` pass.

### Task 4: Documentation And Final Verification

**Files:**
- Modify: `docs/perry-compat.md`
- Modify: `docs/forgets-toolchain.md`
- Modify: `docs/forgets-server-design.md`

- [x] Update the docs from "no Fastify" to "Fastify is the default v1 Perry-native path; raw no-Fastify is deferred."
- [x] Run `npm run check`.
- [x] Run `npm run m1:http`.
- [x] Record final M1 evidence in `docs/perry-compat.md`.
