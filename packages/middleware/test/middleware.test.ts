import { describe, expect, it } from "vitest";
import {
  HttpError,
  normalizeResponse,
  type Context,
  type ResponseValue,
} from "../../http/src/index";
import {
  accessLog,
  bodyLimit,
  recovery,
  requestId,
  timeout,
} from "../src/index";

function createTestContext(overrides: Partial<Context> = {}): Context {
  const responseHeaders: Record<string, string> = {};

  return {
    method: "POST",
    path: "/echo",
    params: {},
    query: {},
    headers: {},
    state: {},
    async json<T>(schema?: { parse(value: unknown): T }) {
      const value = {};
      return schema ? schema.parse(value) : value as T;
    },
    async text() {
      return "hello";
    },
    async bytes() {
      return new TextEncoder().encode("hello");
    },
    status(statusCode) {
      return { statusCode, headers: {}, body: undefined };
    },
    set(name, value) {
      responseHeaders[name.toLowerCase()] = value;
      this.state.responseHeaders = responseHeaders;
    },
    ...overrides,
  };
}

describe("requestId", () => {
  it("stores and returns a request id", async () => {
    const ctx = createTestContext();
    const handler = requestId({ generate: () => "req_test" })(async (inner) => ({
      requestId: inner.state.requestId,
      header: (inner.state.responseHeaders as Record<string, string>)["x-request-id"],
    }));

    await expect(handler(ctx)).resolves.toEqual({
      requestId: "req_test",
      header: "req_test",
    });
  });
});

describe("recovery", () => {
  it("maps unexpected errors to a structured internal error", async () => {
    const handler = recovery()(() => {
      throw new Error("boom");
    });

    const response = normalizeResponse(await handler(createTestContext()));

    expect(response.status).toBe(500);
    expect(response.body).toBe(
      '{"error":{"code":"FORGETS_INTERNAL_ERROR","message":"Internal Server Error","status":500}}',
    );
  });

  it("preserves HttpError values", async () => {
    const handler = recovery()(() => {
      throw HttpError.notFound("Missing", { code: "MISSING" });
    });

    const response = normalizeResponse(await handler(createTestContext()));

    expect(response.status).toBe(404);
    expect(response.body).toBe(
      '{"error":{"code":"MISSING","message":"Missing","status":404}}',
    );
  });
});

describe("bodyLimit", () => {
  it("rejects requests larger than the configured byte limit", async () => {
    const handler = bodyLimit(4)(async (ctx) => ctx.text());
    const response = normalizeResponse(await handler(createTestContext()));

    expect(response.status).toBe(413);
    expect(response.body).toBe(
      '{"error":{"code":"FORGETS_BODY_TOO_LARGE","message":"Payload Too Large","status":413}}',
    );
  });
});

describe("timeout", () => {
  it("returns a timeout error when the handler exceeds the limit", async () => {
    const handler = timeout(1)(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true };
    });

    const response = normalizeResponse(await handler(createTestContext()));

    expect(response.status).toBe(504);
    expect(response.body).toBe(
      '{"error":{"code":"FORGETS_TIMEOUT","message":"Gateway Timeout","status":504}}',
    );
  });
});

describe("accessLog", () => {
  it("records request and response facts", async () => {
    const records: unknown[] = [];
    const handler = accessLog((entry) => records.push(entry), {
      now: (() => {
        let value = 100;
        return () => {
          value += 7;
          return value;
        };
      })(),
    })(async (): Promise<ResponseValue> => ({ ok: true }));

    await handler(createTestContext({
      method: "GET",
      path: "/healthz",
      state: { requestId: "req_log" },
    }));

    expect(records).toEqual([
      {
        method: "GET",
        path: "/healthz",
        status: 200,
        durationMs: 7,
        requestId: "req_log",
      },
    ]);
  });
});
