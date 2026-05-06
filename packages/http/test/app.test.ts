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
});
