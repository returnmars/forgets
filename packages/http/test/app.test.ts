import { describe, expect, it } from "vitest";
import { createApp, group, route } from "../src/index";

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

  it("composes app and route middleware for dispatch", async () => {
    const app = createApp();
    const calls: string[] = [];

    app.use((next) => async (ctx) => {
      calls.push("app:before");
      ctx.state.scope = "global";
      const value = await next(ctx);
      calls.push("app:after");
      return value;
    });

    app.routes(route.get("/healthz", (ctx) => {
      calls.push(String(ctx.state.scope));
      return { ok: true };
    }, {
      middleware: [
        (next) => async (ctx) => {
          calls.push("route:before");
          const value = await next(ctx);
          calls.push("route:after");
          return value;
        },
      ],
    }));

    const [inspected] = app.inspectRoutes();
    const value = await inspected.handler({
      method: "GET",
      path: "/healthz",
      params: {},
      query: {},
      headers: {},
      state: {},
      async json<T>(schema?: { parse(value: unknown): T }) {
        const value = {};
        return schema ? schema.parse(value) : value as T;
      },
      async text() {
        return "";
      },
      async bytes() {
        return new Uint8Array();
      },
      status(statusCode) {
        return { statusCode, headers: {}, body: undefined };
      },
      set() {},
    });

    expect(value).toEqual({ ok: true });
    expect(calls).toEqual([
      "app:before",
      "route:before",
      "global",
      "route:after",
      "app:after",
    ]);
  });
});
