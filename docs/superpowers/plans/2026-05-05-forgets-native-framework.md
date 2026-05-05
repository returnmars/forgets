# Forgets Native Framework Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the verified foundation for a production-ready, human-ergonomic, AI-friendly native TypeScript backend framework that developers write in TypeScript and compile to native binaries with Perry.

**Architecture:** Start with Perry compatibility tests, then implement a small framework kernel with explicit routes, explicit dependencies, schema runtime values, middleware, a clear concurrency contract, and a Perry native fastify driver adapter. Keep Perry-specific behavior behind `@forgets/runtime`, and expose stable diagnostics, manifests, and JSON outputs so humans and AI tools can understand the project without executing user code.

**Tech Stack:** TypeScript, Vitest for host-side unit tests, Perry CLI for native check/compile smoke tests, Perry native fastify stdlib for the first HTTP driver.

---

## Scope

This plan implements the foundation line:

```txt
M0 Perry compatibility baseline
M1 HTTP app kernel
M2 RouteDefinition and static route model
M3 schema MVP and OpenAPI emit
M4 production middleware baseline
M5 generated Perry entry and native build smoke test
M6 human-readable diagnostics and AI-readable project context
```

The full production framework also includes database packages, auth helpers, metrics/tracing, WebSocket/SSE, workers, and deployment templates. Those are separate follow-up plans after this foundation can compile and run under Perry.

---

## File Structure

Create and modify these files:

```txt
package.json
tsconfig.json
vitest.config.ts

packages/http/src/index.ts
packages/http/src/types.ts
packages/http/src/app.ts
packages/http/src/route.ts
packages/http/src/context.ts
packages/http/src/response.ts
packages/http/src/error.ts
packages/http/src/middleware.ts
packages/http/test/app.test.ts
packages/http/test/response.test.ts

packages/schema/src/index.ts
packages/schema/src/schema.ts
packages/schema/src/openapi.ts
packages/schema/test/schema.test.ts
packages/schema/test/openapi.test.ts

packages/logger/src/index.ts
packages/logger/src/logger.ts

packages/middleware/src/index.ts
packages/middleware/src/request-id.ts
packages/middleware/src/recovery.ts
packages/middleware/src/timeout.ts
packages/middleware/src/access-log.ts
packages/middleware/test/middleware.test.ts

packages/runtime/src/index.ts
packages/runtime/src/driver.ts
packages/runtime/src/perry-fastify.ts
packages/runtime/test/driver.test.ts

packages/compiler/src/index.ts
packages/compiler/src/static-routes.ts
packages/compiler/src/openapi.ts
packages/compiler/src/generate-entry.ts
packages/compiler/src/diagnostics.ts
packages/compiler/src/ai-context.ts
packages/compiler/test/static-routes.test.ts
packages/compiler/test/generate-entry.test.ts
packages/compiler/test/diagnostics.test.ts

packages/cli/src/index.ts
packages/cli/src/commands/check.ts
packages/cli/src/commands/routes.ts
packages/cli/src/commands/openapi.ts
packages/cli/src/commands/build.ts

examples/hello-world/src/main.ts
examples/hello-world/src/server.ts
examples/hello-world/src/app.ts
examples/hello-world/src/health.routes.ts
examples/hello-world/forgets.config.ts

test-files/forgets-m0/decorators-fail.ts
test-files/forgets-m0/basic-runtime.ts
test-files/forgets-m0/async-concurrency.ts
test-files/forgets-m0/thread-spawn.ts
test-files/forgets-m0/abort-timeout.ts
test-files/forgets-m0/fastify-smoke.ts
test-files/forgets-m0/fastify-concurrent.ts
scripts/forgets-m0.ps1

docs/perry-compat.md
docs/plaints-server-design.md
docs/schemas/manifest.schema.json
docs/schemas/diagnostics.schema.json
docs/schemas/ai-context.schema.json
```

Each package has one responsibility:

```txt
http      public app, routes, context, middleware, errors, response normalization
schema    runtime schema values, parsing, type inference, OpenAPI schema emit
logger    structured logger
middleware production middleware such as request id/access log/recovery/timeout
runtime   Perry driver adapter hidden behind the framework API
compiler  static route scanner, OpenAPI document generation, Perry entry generation, diagnostics, AI context
cli       user-facing commands that call compiler and Perry
```

---

### Task 1: Workspace Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create root package manifest**

```json
{
  "name": "forgets-workspace",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "m0": "powershell -ExecutionPolicy Bypass -File scripts/forgets-m0.ps1"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "typescript": "^5.6.3",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@forgets/http": ["packages/http/src/index.ts"],
      "@forgets/schema": ["packages/schema/src/index.ts"],
      "@forgets/logger": ["packages/logger/src/index.ts"],
      "@forgets/middleware": ["packages/middleware/src/index.ts"],
      "@forgets/runtime": ["packages/runtime/src/index.ts"],
      "@forgets/compiler": ["packages/compiler/src/index.ts"]
    }
  },
  "include": ["packages/**/*.ts", "examples/**/*.ts", "test-files/**/*.ts"]
}
```

- [ ] **Step 3: Create Vitest config**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 5: Run empty test command**

Run: `npm test -- --passWithNoTests`

Expected: Vitest exits successfully with no discovered tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: scaffold forgets workspace"
```

---

### Task 2: HTTP Core Types and Route Values

**Files:**
- Create: `packages/http/src/types.ts`
- Create: `packages/http/src/route.ts`
- Create: `packages/http/src/index.ts`
- Test: `packages/http/test/app.test.ts`

- [ ] **Step 1: Write route value tests**

```ts
import { describe, expect, it } from "vitest";
import { group, route } from "../src/index";

describe("route values", () => {
  it("creates explicit route definitions", () => {
    const handler = () => ({ ok: true });
    const def = route.get("/healthz", handler, { tags: ["Health"] });

    expect(def).toEqual({
      kind: "route",
      method: "GET",
      path: "/healthz",
      handler,
      options: { tags: ["Health"] },
    });
  });

  it("creates route groups", () => {
    const handler = () => ({ ok: true });
    const routes = group("/api", [route.get("/healthz", handler)]);

    expect(routes.kind).toBe("group");
    expect(routes.prefix).toBe("/api");
    expect(routes.routes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/http/test/app.test.ts`

Expected: FAIL because `../src/index` does not exist.

- [ ] **Step 3: Add HTTP types**

```ts
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface RouteOptions {
  params?: unknown;
  query?: unknown;
  body?: unknown;
  response?: unknown;
  summary?: string;
  description?: string;
  tags?: string[];
  middleware?: Middleware[];
}

export type ResponseValue =
  | undefined
  | null
  | string
  | Uint8Array
  | Record<string, unknown>
  | unknown[]
  | ResponseBuilder;

export interface Context {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  state: Record<string, unknown>;
  signal?: AbortSignal;
  json<T>(schema?: { parse(value: unknown): T }): Promise<T>;
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;
  status(code: number): ResponseBuilder;
  set(name: string, value: string): void;
}

export interface ResponseBuilder {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export type Handler = (ctx: Context) => Promise<ResponseValue> | ResponseValue;
export type Middleware = (next: Handler) => Handler;

export interface RouteDefinition {
  kind: "route";
  method: HttpMethod;
  path: string;
  handler: Handler;
  options: RouteOptions;
}

export interface RouteGroup {
  kind: "group";
  prefix: string;
  routes: RouteEntry[];
}

export type RouteEntry = RouteDefinition | RouteGroup;
```

- [ ] **Step 4: Add route helpers**

```ts
import type { Handler, HttpMethod, RouteDefinition, RouteEntry, RouteGroup, RouteOptions } from "./types";

function makeRoute(method: HttpMethod, path: string, handler: Handler, options: RouteOptions = {}): RouteDefinition {
  return {
    kind: "route",
    method,
    path,
    handler,
    options,
  };
}

export const route = {
  get: (path: string, handler: Handler, options?: RouteOptions) => makeRoute("GET", path, handler, options),
  post: (path: string, handler: Handler, options?: RouteOptions) => makeRoute("POST", path, handler, options),
  put: (path: string, handler: Handler, options?: RouteOptions) => makeRoute("PUT", path, handler, options),
  patch: (path: string, handler: Handler, options?: RouteOptions) => makeRoute("PATCH", path, handler, options),
  delete: (path: string, handler: Handler, options?: RouteOptions) => makeRoute("DELETE", path, handler, options),
  head: (path: string, handler: Handler, options?: RouteOptions) => makeRoute("HEAD", path, handler, options),
  options: (path: string, handler: Handler, options?: RouteOptions) => makeRoute("OPTIONS", path, handler, options),
};

export function group(prefix: string, routes: RouteEntry[]): RouteGroup {
  return {
    kind: "group",
    prefix,
    routes,
  };
}
```

- [ ] **Step 5: Export public API**

```ts
export * from "./types";
export { group, route } from "./route";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run packages/http/test/app.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/http
git commit -m "feat(http): add explicit route values"
```

---

### Task 3: App Registry and Duplicate Route Checks

**Files:**
- Create: `packages/http/src/app.ts`
- Modify: `packages/http/src/index.ts`
- Test: `packages/http/test/app.test.ts`

- [ ] **Step 1: Extend app tests**

Add these tests below the existing `route values` suite:

```ts
import { createApp } from "../src/index";

describe("app registry", () => {
  it("registers grouped routes", () => {
    const app = createApp();
    app.routes(group("/api", [route.get("/healthz", () => ({ ok: true }))]));

    expect(app.inspectRoutes()).toMatchObject([
      { method: "GET", path: "/api/healthz" },
    ]);
  });

  it("rejects duplicate method/path pairs", () => {
    const app = createApp();
    app.get("/healthz", () => ({ ok: true }));

    expect(() => app.get("/healthz", () => ({ ok: true }))).toThrow(
      "Duplicate route: GET /healthz",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/http/test/app.test.ts`

Expected: FAIL because `createApp` does not exist.

- [ ] **Step 3: Add app implementation**

```ts
import { group, route } from "./route";
import type { Handler, HttpMethod, Middleware, RouteDefinition, RouteEntry, RouteOptions } from "./types";

export interface InspectedRoute {
  method: HttpMethod;
  path: string;
  route: RouteDefinition;
}

export interface App {
  use(middleware: Middleware): void;
  route(method: HttpMethod, path: string, handler: Handler, options?: RouteOptions): void;
  get(path: string, handler: Handler, options?: RouteOptions): void;
  post(path: string, handler: Handler, options?: RouteOptions): void;
  routes(routes: RouteEntry | RouteEntry[]): void;
  inspectRoutes(): InspectedRoute[];
}

export function createApp(): App {
  const middleware: Middleware[] = [];
  const registered: InspectedRoute[] = [];
  const keys = new Set<string>();

  function addRoute(prefix: string, entry: RouteEntry): void {
    if (entry.kind === "group") {
      for (const child of entry.routes) {
        addRoute(joinPaths(prefix, entry.prefix), child);
      }
      return;
    }

    const path = joinPaths(prefix, entry.path);
    const key = `${entry.method} ${path}`;

    if (keys.has(key)) {
      throw new Error(`Duplicate route: ${key}`);
    }

    keys.add(key);
    registered.push({ method: entry.method, path, route: entry });
  }

  return {
    use(next) {
      middleware.push(next);
    },
    route(method, path, handler, options) {
      addRoute("", { ...route.get(path, handler, options), method });
    },
    get(path, handler, options) {
      addRoute("", route.get(path, handler, options));
    },
    post(path, handler, options) {
      addRoute("", route.post(path, handler, options));
    },
    routes(input) {
      const entries = Array.isArray(input) ? input : [input];
      for (const entry of entries) {
        addRoute("", entry);
      }
    },
    inspectRoutes() {
      return [...registered];
    },
  };
}

export function joinPaths(prefix: string, path: string): string {
  const left = prefix === "/" ? "" : prefix.replace(/\/+$/, "");
  const right = path === "/" ? "" : path.replace(/^\/+/, "");
  const joined = `${left}/${right}`.replace(/\/+/g, "/");
  return joined === "" ? "/" : joined;
}
```

- [ ] **Step 4: Export `createApp`**

```ts
export * from "./types";
export { createApp } from "./app";
export { group, route } from "./route";
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/http/test/app.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/http
git commit -m "feat(http): add app route registry"
```

---

### Task 4: Response Normalization and HttpError

**Files:**
- Create: `packages/http/src/error.ts`
- Create: `packages/http/src/response.ts`
- Modify: `packages/http/src/index.ts`
- Test: `packages/http/test/response.test.ts`

- [ ] **Step 1: Write response tests**

```ts
import { describe, expect, it } from "vitest";
import { HttpError, normalizeResponse } from "../src/index";

describe("response normalization", () => {
  it("maps undefined to 204", () => {
    expect(normalizeResponse(undefined)).toEqual({
      status: 204,
      headers: {},
      body: undefined,
    });
  });

  it("maps objects to JSON", () => {
    expect(normalizeResponse({ ok: true })).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
  });

  it("maps HttpError to structured error body", () => {
    const response = normalizeResponse(HttpError.notFound("Missing", { code: "MISSING" }));

    expect(response.status).toBe(404);
    expect(JSON.parse(String(response.body))).toEqual({
      error: {
        code: "MISSING",
        message: "Missing",
        status: 404,
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/http/test/response.test.ts`

Expected: FAIL because `HttpError` and `normalizeResponse` do not exist.

- [ ] **Step 3: Add HttpError**

```ts
export interface HttpErrorOptions {
  code?: string;
  details?: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = options.code ?? `HTTP_${status}`;
    this.details = options.details;
  }

  static badRequest(message = "Bad Request", options: HttpErrorOptions = {}) {
    return new HttpError(400, message, options);
  }

  static unauthorized(message = "Unauthorized", options: HttpErrorOptions = {}) {
    return new HttpError(401, message, options);
  }

  static notFound(message = "Not Found", options: HttpErrorOptions = {}) {
    return new HttpError(404, message, options);
  }

  static internal(message = "Internal Server Error", options: HttpErrorOptions = {}) {
    return new HttpError(500, message, options);
  }
}
```

- [ ] **Step 4: Add response normalization**

```ts
import { HttpError } from "./error";

export interface NormalizedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export function normalizeResponse(value: unknown): NormalizedResponse {
  if (value instanceof HttpError) {
    return json(value.status, {
      error: {
        code: value.code,
        message: value.message,
        status: value.status,
      },
    });
  }

  if (value === undefined) {
    return { status: 204, headers: {}, body: undefined };
  }

  if (typeof value === "string") {
    return { status: 200, headers: { "content-type": "text/plain" }, body: value };
  }

  if (value instanceof Uint8Array) {
    return { status: 200, headers: { "content-type": "application/octet-stream" }, body: value };
  }

  return json(200, value);
}

function json(status: number, value: unknown): NormalizedResponse {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}
```

- [ ] **Step 5: Export error and response APIs**

```ts
export * from "./types";
export { createApp } from "./app";
export { HttpError } from "./error";
export { normalizeResponse } from "./response";
export { group, route } from "./route";
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run packages/http/test/response.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/http
git commit -m "feat(http): normalize responses and errors"
```

---

### Task 5: Schema MVP

**Files:**
- Create: `packages/schema/src/schema.ts`
- Create: `packages/schema/src/index.ts`
- Test: `packages/schema/test/schema.test.ts`

- [ ] **Step 1: Write schema tests**

```ts
import { describe, expect, it } from "vitest";
import { schema } from "../src/index";

describe("schema", () => {
  it("parses objects", () => {
    const User = schema.object({
      id: schema.string(),
      age: schema.number().default(18),
    });

    expect(User.parse({ id: "u1" })).toEqual({ id: "u1", age: 18 });
  });

  it("formats validation errors", () => {
    const User = schema.object({ id: schema.string() });

    expect(() => User.parse({ id: 1 })).toThrow("Expected string at id");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/schema/test/schema.test.ts`

Expected: FAIL because `schema` does not exist.

- [ ] **Step 3: Add schema implementation**

```ts
export interface Schema<T> {
  parse(value: unknown, path?: string): T;
  optional(): Schema<T | undefined>;
  default(value: T): Schema<T>;
}

class BaseSchema<T> implements Schema<T> {
  constructor(private readonly parser: (value: unknown, path: string) => T) {}

  parse(value: unknown, path = ""): T {
    return this.parser(value, path);
  }

  optional(): Schema<T | undefined> {
    return new BaseSchema((value, path) => {
      if (value === undefined) return undefined;
      return this.parse(value, path);
    });
  }

  default(defaultValue: T): Schema<T> {
    return new BaseSchema((value, path) => {
      if (value === undefined) return defaultValue;
      return this.parse(value, path);
    });
  }
}

type Shape = Record<string, Schema<unknown>>;
type InferShape<T extends Shape> = { [K in keyof T]: T[K] extends Schema<infer V> ? V : never };

export const schema = {
  string(): Schema<string> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "string") throw new Error(`Expected string at ${path || "$"}`);
      return value;
    });
  },
  number(): Schema<number> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "number") throw new Error(`Expected number at ${path || "$"}`);
      return value;
    });
  },
  boolean(): Schema<boolean> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "boolean") throw new Error(`Expected boolean at ${path || "$"}`);
      return value;
    });
  },
  object<T extends Shape>(shape: T): Schema<InferShape<T>> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Expected object at ${path || "$"}`);
      }

      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};

      for (const key of Object.keys(shape)) {
        output[key] = shape[key].parse(input[key], path ? `${path}.${key}` : key);
      }

      return output as InferShape<T>;
    });
  },
  unknown(): Schema<unknown> {
    return new BaseSchema((value) => value);
  },
};

export type Infer<T> = T extends Schema<infer V> ? V : never;
```

- [ ] **Step 4: Export schema**

```ts
export { schema } from "./schema";
export type { Infer, Schema } from "./schema";
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/schema/test/schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): add Perry-compatible schema MVP"
```

---

### Task 6: M0 Perry Compatibility Fixtures

**Files:**
- Create: `test-files/forgets-m0/decorators-fail.ts`
- Create: `test-files/forgets-m0/basic-runtime.ts`
- Create: `test-files/forgets-m0/async-concurrency.ts`
- Create: `test-files/forgets-m0/thread-spawn.ts`
- Create: `test-files/forgets-m0/abort-timeout.ts`
- Create: `test-files/forgets-m0/fastify-smoke.ts`
- Create: `test-files/forgets-m0/fastify-concurrent.ts`
- Create: `scripts/forgets-m0.ps1`
- Modify: `docs/perry-compat.md`

- [ ] **Step 1: Add decorators failure fixture**

```ts
function Controller(): ClassDecorator {
  return () => {};
}

@Controller()
class DemoController {}

console.log(DemoController);
```

- [ ] **Step 2: Add basic runtime fixture**

```ts
class Box {
  #value: number;

  constructor(value: number) {
    this.#value = value;
  }

  get value() {
    return this.#value;
  }
}

const encoded = new TextEncoder().encode("forgets");
const data = new Map<string, number>();
data.set("answer", 42);

console.log(JSON.stringify({
  value: new Box(7).value,
  map: data.get("answer"),
  bytes: encoded.length,
  ok: Promise.resolve(true) instanceof Promise,
}));
```

- [ ] **Step 3: Add async concurrency fixture**

```ts
function delay(ms: number, value: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

async function main() {
  const started = Date.now();
  const values = await Promise.all([
    delay(20, "a"),
    delay(20, "b"),
    delay(20, "c"),
  ]);

  console.log(JSON.stringify({
    values,
    elapsedMs: Date.now() - started,
  }));
}

await main();
```

- [ ] **Step 4: Add Perry thread fixture**

```ts
import { parallelMap, spawn } from "perry/thread";

const task = spawn(() => {
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    total += i;
  }
  return total;
});

const doubled = parallelMap([1, 2, 3, 4], (value: number) => value * 2);
const total = await task;

console.log(JSON.stringify({
  total,
  doubled,
}));
```

- [ ] **Step 5: Add Abort fixture**

```ts
const controller = new AbortController();
let fired = false;

controller.signal.addEventListener("abort", () => {
  fired = true;
});

controller.abort("done");

const timeoutSignal = AbortSignal.timeout(10);

console.log(JSON.stringify({
  aborted: controller.signal.aborted,
  fired,
  timeoutInitiallyAborted: timeoutSignal.aborted,
}));
```

- [ ] **Step 6: Add fastify smoke fixture**

```ts
import fastify from "fastify";

const app = fastify();

app.get("/healthz", async (_request, reply) => {
  reply.status(200);
  return { ok: true };
});

app.listen({ port: 3000, host: "127.0.0.1" });
```

- [ ] **Step 7: Add fastify concurrency smoke fixture**

```ts
import fastify from "fastify";

const app = fastify();

let inFlight = 0;
let maxInFlight = 0;

app.get("/wait", async (_request, reply) => {
  inFlight += 1;
  if (inFlight > maxInFlight) {
    maxInFlight = inFlight;
  }

  await new Promise((resolve) => setTimeout(resolve, 50));

  inFlight -= 1;
  reply.status(200);
  return { maxInFlight };
});

app.listen({ port: 3001, host: "127.0.0.1" });
```

- [ ] **Step 8: Add M0 PowerShell runner**

```powershell
$ErrorActionPreference = "Stop"

$Perry = "perry"
$Cases = @(
  @{ Name = "decorators-fail"; File = "test-files/forgets-m0/decorators-fail.ts"; ExpectCheckFailure = $true },
  @{ Name = "basic-runtime"; File = "test-files/forgets-m0/basic-runtime.ts"; ExpectCheckFailure = $false },
  @{ Name = "async-concurrency"; File = "test-files/forgets-m0/async-concurrency.ts"; ExpectCheckFailure = $false },
  @{ Name = "thread-spawn"; File = "test-files/forgets-m0/thread-spawn.ts"; ExpectCheckFailure = $false },
  @{ Name = "abort-timeout"; File = "test-files/forgets-m0/abort-timeout.ts"; ExpectCheckFailure = $false }
)

foreach ($Case in $Cases) {
  Write-Host "== $($Case.Name): perry check =="
  & $Perry check $Case.File
  $ExitCode = $LASTEXITCODE

  if ($Case.ExpectCheckFailure -and $ExitCode -eq 0) {
    throw "$($Case.Name) was expected to fail perry check"
  }

  if (-not $Case.ExpectCheckFailure -and $ExitCode -ne 0) {
    throw "$($Case.Name) was expected to pass perry check"
  }
}
```

- [ ] **Step 9: Run M0 script**

Run: `npm run m0`

Expected: decorators fail check; basic runtime, async concurrency, thread spawn, and abort fixtures pass check. If `perry` is not on PATH, record the missing binary in `docs/perry-compat.md`.

- [ ] **Step 10: Update compatibility document results**

Add a `## M0 Results` section to `docs/perry-compat.md`:

```md
## M0 Results

| Case | Check | Compile | Run | Notes |
| --- | --- | --- | --- | --- |
| decorators-fail | expected failure | not run | not run | Perry rejects decorators at lowering |
| basic-runtime | not run | not run | not run | Records class/private/TextEncoder/Map/Promise behavior |
| async-concurrency | not run | not run | not run | Records Promise.all/timer async behavior |
| thread-spawn | not run | not run | not run | Records perry/thread spawn and parallelMap behavior |
| abort-timeout | not run | not run | not run | Records AbortController and AbortSignal.timeout behavior |
| fastify-smoke | not run | not run | not run | Requires separate server smoke command |
| fastify-concurrent | not run | not run | not run | Requires native server plus parallel client requests |
```

- [ ] **Step 11: Commit**

```bash
git add test-files/forgets-m0 scripts/forgets-m0.ps1 docs/perry-compat.md
git commit -m "test: add Perry compatibility baseline fixtures"
```

---

### Task 7: Static Route Scanner Foundation

**Files:**
- Create: `packages/compiler/src/static-routes.ts`
- Create: `packages/compiler/src/index.ts`
- Test: `packages/compiler/test/static-routes.test.ts`

- [ ] **Step 1: Write static scanner tests**

```ts
import { describe, expect, it } from "vitest";
import { inspectStaticRoutes } from "../src/index";

describe("inspectStaticRoutes", () => {
  it("finds static route.get calls inside route factories", () => {
    const source = `
      export function usersRoutes(controller) {
        return group("/users", [
          route.get("/:id", ctx => controller.get(ctx), {
            response: User,
            tags: ["Users"],
          }),
        ]);
      }
    `;

    expect(inspectStaticRoutes(source)).toEqual([
      {
        method: "GET",
        path: "/users/:id",
        tags: ["Users"],
        source: "usersRoutes[0]",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/compiler/test/static-routes.test.ts`

Expected: FAIL because `inspectStaticRoutes` does not exist.

- [ ] **Step 3: Add AST-based scanner**

```ts
import * as ts from "typescript";

export interface StaticRoute {
  method: string;
  path: string;
  tags: string[];
  source: string;
}

export function inspectStaticRoutes(sourceText: string): StaticRoute[] {
  const file = ts.createSourceFile("routes.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const routes: StaticRoute[] = [];

  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement)) continue;
    if (!statement.name || !hasExportModifier(statement)) continue;
    if (!statement.body) continue;

    const factoryName = statement.name.text;
    const returnedGroup = findReturnedGroup(statement.body);
    if (!returnedGroup) continue;

    const [prefixArg, routesArg] = returnedGroup.arguments;
    if (!prefixArg || !routesArg) continue;
    if (!ts.isStringLiteral(prefixArg) || !ts.isArrayLiteralExpression(routesArg)) continue;

    let index = 0;
    for (const element of routesArg.elements) {
      const route = readRouteCall(element, prefixArg.text, factoryName, index);
      if (route) {
        routes.push(route);
        index += 1;
      }
    }
  }

  return routes;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function findReturnedGroup(body: ts.Block): ts.CallExpression | undefined {
  for (const statement of body.statements) {
    if (!ts.isReturnStatement(statement) || !statement.expression) continue;
    if (!ts.isCallExpression(statement.expression)) continue;

    const call = statement.expression;
    if (ts.isIdentifier(call.expression) && call.expression.text === "group") {
      return call;
    }
  }

  return undefined;
}

function readRouteCall(node: ts.Node, prefix: string, factoryName: string, index: number): StaticRoute | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  if (!ts.isIdentifier(node.expression.expression)) return undefined;
  if (node.expression.expression.text !== "route") return undefined;

  const method = node.expression.name.text.toUpperCase();
  const [pathArg, _handlerArg, optionsArg] = node.arguments;

  if (!pathArg || !ts.isStringLiteral(pathArg)) return undefined;

  return {
    method,
    path: joinPaths(prefix, pathArg.text),
    tags: readTags(optionsArg),
    source: `${factoryName}[${index}]`,
  };
}

function readTags(node: ts.Node | undefined): string[] {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (!ts.isIdentifier(property.name) || property.name.text !== "tags") continue;
    if (!ts.isArrayLiteralExpression(property.initializer)) return [];

    return property.initializer.elements
      .filter(ts.isStringLiteral)
      .map((item) => item.text);
  }

  return [];
}

function joinPaths(prefix: string, path: string): string {
  const left = prefix.replace(/\/+$/, "");
  const right = path.replace(/^\/+/, "");
  return `${left}/${right}`.replace(/\/+/g, "/");
}
```

- [ ] **Step 4: Export compiler API**

```ts
export { inspectStaticRoutes } from "./static-routes";
export type { StaticRoute } from "./static-routes";
```

- [ ] **Step 5: Run test**

Run: `npx vitest run packages/compiler/test/static-routes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/compiler
git commit -m "feat(compiler): inspect static route factories"
```

---

### Task 8: Generated Perry Entry

**Files:**
- Create: `packages/compiler/src/generate-entry.ts`
- Modify: `packages/compiler/src/index.ts`
- Test: `packages/compiler/test/generate-entry.test.ts`

- [ ] **Step 1: Write generated entry test**

```ts
import { describe, expect, it } from "vitest";
import { generatePerryEntry } from "../src/index";

describe("generatePerryEntry", () => {
  it("generates a single Perry entry file", () => {
    expect(generatePerryEntry({
      serverImport: "../src/server",
      serverExport: "buildServer",
    })).toContain("await app.listen(config.PORT);");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/compiler/test/generate-entry.test.ts`

Expected: FAIL because `generatePerryEntry` does not exist.

- [ ] **Step 3: Add entry generator**

```ts
export interface PerryEntryOptions {
  serverImport: string;
  serverExport: string;
}

export function generatePerryEntry(options: PerryEntryOptions): string {
  return [
    `import { ${options.serverExport} } from "${options.serverImport}";`,
    "",
    `const { app, config } = await ${options.serverExport}();`,
    "await app.listen(config.PORT);",
    "",
  ].join("\n");
}
```

- [ ] **Step 4: Export generator**

```ts
export { generatePerryEntry } from "./generate-entry";
export type { PerryEntryOptions } from "./generate-entry";
export { inspectStaticRoutes } from "./static-routes";
export type { StaticRoute } from "./static-routes";
```

- [ ] **Step 5: Run test**

Run: `npx vitest run packages/compiler/test/generate-entry.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/compiler
git commit -m "feat(compiler): generate Perry entry"
```

---

### Task 9: Human Diagnostics and AI Context

**Files:**
- Create: `packages/compiler/src/diagnostics.ts`
- Create: `packages/compiler/src/ai-context.ts`
- Modify: `packages/compiler/src/index.ts`
- Test: `packages/compiler/test/diagnostics.test.ts`

- [ ] **Step 1: Write diagnostics and AI context tests**

```ts
import { describe, expect, it } from "vitest";
import { createAiContext, formatDiagnostic } from "../src/index";

describe("diagnostics", () => {
  it("formats diagnostics for humans", () => {
    expect(formatDiagnostic({
      code: "FORGETS_ROUTE_DYNAMIC_PATH",
      severity: "warning",
      file: "src/users/users.routes.ts",
      line: 12,
      message: "Dynamic route path cannot be included in OpenAPI.",
      suggestion: "Use a string literal path such as route.get(\"/:id\", handler).",
    })).toBe([
      "warning FORGETS_ROUTE_DYNAMIC_PATH",
      "src/users/users.routes.ts:12",
      "Dynamic route path cannot be included in OpenAPI.",
      "Suggestion: Use a string literal path such as route.get(\"/:id\", handler).",
    ].join("\n"));
  });
});

describe("AI context", () => {
  it("creates stable machine-readable project facts", () => {
    expect(createAiContext({
      projectName: "hello-world",
      perryVersion: "0.5.494",
      generatedEntry: ".forgets/perry-entry.generated.ts",
      routes: [
        {
          method: "GET",
          path: "/healthz",
          tags: ["Health"],
          source: "healthRoutes[0]",
        },
      ],
      configKeys: ["PORT", "LOG_LEVEL"],
      diagnostics: [],
      nativeCompatibility: {
        status: "unknown",
        perryCheck: "not-run",
        perryCompile: "not-run",
        nativeSmoke: "not-run",
      },
    })).toEqual({
      schemaVersion: 1,
      framework: "forgets",
      projectName: "hello-world",
      perryVersion: "0.5.494",
      generatedEntry: ".forgets/perry-entry.generated.ts",
      routes: [
        {
          method: "GET",
          path: "/healthz",
          tags: ["Health"],
          source: "healthRoutes[0]",
        },
      ],
      configKeys: ["PORT", "LOG_LEVEL"],
      diagnostics: [],
      nativeCompatibility: {
        status: "unknown",
        perryCheck: "not-run",
        perryCompile: "not-run",
        nativeSmoke: "not-run",
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/compiler/test/diagnostics.test.ts`

Expected: FAIL because `formatDiagnostic` and `createAiContext` do not exist.

- [ ] **Step 3: Add diagnostics model**

```ts
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
  docsUrl?: string;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const lines = [
    `${diagnostic.severity} ${diagnostic.code}`,
  ];

  if (diagnostic.file) {
    lines.push(diagnostic.line === undefined ? diagnostic.file : `${diagnostic.file}:${diagnostic.line}`);
  }

  lines.push(diagnostic.message);

  if (diagnostic.suggestion) {
    lines.push(`Suggestion: ${diagnostic.suggestion}`);
  }

  if (diagnostic.docsUrl) {
    lines.push(`Docs: ${diagnostic.docsUrl}`);
  }

  return lines.join("\n");
}

export function diagnosticsToJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify({
    schemaVersion: 1,
    diagnostics,
  }, null, 2);
}
```

- [ ] **Step 4: Add AI context model**

```ts
import type { Diagnostic } from "./diagnostics";

export interface AiRouteFact {
  method: string;
  path: string;
  tags: string[];
  source: string;
}

export interface AiContextInput {
  projectName: string;
  perryVersion: string;
  generatedEntry: string;
  routes: AiRouteFact[];
  configKeys: string[];
  diagnostics: Diagnostic[];
  nativeCompatibility: NativeCompatibility;
}

export interface NativeCompatibility {
  status: "unknown" | "passed" | "failed";
  perryCheck: "not-run" | "passed" | "failed";
  perryCompile: "not-run" | "passed" | "failed";
  nativeSmoke: "not-run" | "passed" | "failed";
}

export interface AiContext {
  schemaVersion: 1;
  framework: "forgets";
  projectName: string;
  perryVersion: string;
  generatedEntry: string;
  routes: AiRouteFact[];
  configKeys: string[];
  diagnostics: Diagnostic[];
  nativeCompatibility: NativeCompatibility;
}

export function createAiContext(input: AiContextInput): AiContext {
  return {
    schemaVersion: 1,
    framework: "forgets",
    projectName: input.projectName,
    perryVersion: input.perryVersion,
    generatedEntry: input.generatedEntry,
    routes: input.routes,
    configKeys: input.configKeys,
    diagnostics: input.diagnostics,
    nativeCompatibility: input.nativeCompatibility,
  };
}

export function aiContextToJson(input: AiContextInput): string {
  return JSON.stringify(createAiContext(input), null, 2);
}
```

- [ ] **Step 5: Export diagnostics and AI context APIs**

```ts
export { createAiContext, aiContextToJson } from "./ai-context";
export type { AiContext, AiContextInput, AiRouteFact, NativeCompatibility } from "./ai-context";
export { diagnosticsToJson, formatDiagnostic } from "./diagnostics";
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics";
export { generatePerryEntry } from "./generate-entry";
export type { PerryEntryOptions } from "./generate-entry";
export { inspectStaticRoutes } from "./static-routes";
export type { StaticRoute } from "./static-routes";
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run packages/compiler/test/diagnostics.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/compiler
git commit -m "feat(compiler): add human diagnostics and AI context"
```

---

### Task 10: Artifact JSON Schemas

**Files:**
- Modify: `docs/schemas/manifest.schema.json`
- Modify: `docs/schemas/diagnostics.schema.json`
- Modify: `docs/schemas/ai-context.schema.json`
- Test: `packages/compiler/test/diagnostics.test.ts`

- [ ] **Step 1: Verify schema files exist**

Run:

```bash
node -e "for (const f of ['docs/schemas/manifest.schema.json','docs/schemas/diagnostics.schema.json','docs/schemas/ai-context.schema.json']) { JSON.parse(require('fs').readFileSync(f, 'utf8')); console.log(f) }"
```

Expected: all three paths print and the command exits with code 0.

- [ ] **Step 2: Add schema path constants**

Add this to `packages/compiler/src/diagnostics.ts`:

```ts
export const artifactSchemas = {
  manifest: "docs/schemas/manifest.schema.json",
  diagnostics: "docs/schemas/diagnostics.schema.json",
  aiContext: "docs/schemas/ai-context.schema.json",
} as const;
```

- [ ] **Step 3: Add schema path test**

Append this test to `packages/compiler/test/diagnostics.test.ts`:

```ts
import { artifactSchemas } from "../src/index";

describe("artifact schemas", () => {
  it("exposes stable schema locations", () => {
    expect(artifactSchemas).toEqual({
      manifest: "docs/schemas/manifest.schema.json",
      diagnostics: "docs/schemas/diagnostics.schema.json",
      aiContext: "docs/schemas/ai-context.schema.json",
    });
  });
});
```

- [ ] **Step 4: Export schema path constants**

Update `packages/compiler/src/index.ts`:

```ts
export { createAiContext, aiContextToJson } from "./ai-context";
export type { AiContext, AiContextInput, AiRouteFact, NativeCompatibility } from "./ai-context";
export { artifactSchemas, diagnosticsToJson, formatDiagnostic } from "./diagnostics";
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics";
export { generatePerryEntry } from "./generate-entry";
export type { PerryEntryOptions } from "./generate-entry";
export { inspectStaticRoutes } from "./static-routes";
export type { StaticRoute } from "./static-routes";
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/compiler/test/diagnostics.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/schemas packages/compiler
git commit -m "feat(compiler): publish artifact JSON schema contracts"
```

---

## Self-Review Checklist

- [ ] `docs/plaints-server-design.md` still states the complete production-framework target.
- [ ] `docs/perry-compat.md` records Perry version `0.5.494`.
- [ ] Generated Perry entry imports `buildServer()` and no user module performs top-level listen as a build contract.
- [ ] No public API depends on decorators, `reflect-metadata`, or runtime type reflection.
- [ ] Route factories remain statically inspectable without executing user code.
- [ ] `@forgets/runtime` hides Perry native fastify details.
- [ ] Concurrency contract states default async, explicit CPU parallelism, and per-request Context isolation.
- [ ] Diagnostics have stable codes, human formatting, and JSON formatting.
- [ ] AI context output excludes secret values and includes route/config/native facts.
- [ ] Artifact JSON outputs have checked-in schemas under `docs/schemas`.
- [ ] Host tests pass with `npm test`.
- [ ] TypeScript passes with `npm run typecheck`.
- [ ] M0 script records Perry check behavior with `npm run m0`.
- [ ] M0/M1 native suites include async concurrency, perry/thread, concurrent requests, and CPU-bound offload behavior.
- [ ] Native production claims are backed by Perry compile/run results.
