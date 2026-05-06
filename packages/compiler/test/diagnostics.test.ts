import { describe, expect, it } from "vitest";
import { artifactSchemas, createAiContext, formatDiagnostic } from "../src/index";

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
      forgetsVersion: "0.1.0",
      perryVersion: "0.5.494",
      packages: ["@forgets/http", "@forgets/runtime"],
      generatedEntry: ".forgets/perry-entry.generated.ts",
      routes: [
        {
          method: "GET",
          path: "/healthz",
          tags: ["Health"],
          source: "src/health.routes.ts",
          factory: "healthRoutes",
          index: 0,
        },
      ],
      schemaNames: [],
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
      forgetsVersion: "0.1.0",
      perryVersion: "0.5.494",
      packages: ["@forgets/http", "@forgets/runtime"],
      generatedEntry: ".forgets/perry-entry.generated.ts",
      routes: [
        {
          method: "GET",
          path: "/healthz",
          tags: ["Health"],
          source: "src/health.routes.ts",
          factory: "healthRoutes",
          index: 0,
        },
      ],
      schemaNames: [],
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

describe("artifact schemas", () => {
  it("exposes stable schema locations", () => {
    expect(artifactSchemas).toEqual({
      manifest: "docs/schemas/manifest.schema.json",
      diagnostics: "docs/schemas/diagnostics.schema.json",
      aiContext: "docs/schemas/ai-context.schema.json",
    });
  });
});
