import { describe, expect, it } from "vitest";
import { createApp } from "../../http/src/index";
import {
  createFastifyHttpDriver,
} from "../src/index";
import { createPerryHttpTransport, createTransportHttpDriver } from "../src/raw-driver";
import type {
  NativeHttpRequestSnapshot,
  NativeHttpTransport,
  NativeWriteResponse,
  PerryHttpPrimitives,
} from "../src/raw-driver";

class MemoryTransport implements NativeHttpTransport {
  readonly responses: NativeWriteResponse[] = [];

  constructor(private readonly request: NativeHttpRequestSnapshot) {}

  createServer(_port: number): number {
    return 1;
  }

  accept(_server: number): number {
    return this.request.id;
  }

  snapshot(_request: number): NativeHttpRequestSnapshot {
    return this.request;
  }

  respond(_request: number, response: NativeWriteResponse): boolean {
    this.responses.push(response);
    return true;
  }
}

describe("native HTTP driver", () => {
  it("registers forgets routes on a Fastify server", async () => {
    const app = createApp();
    app.get("/healthz", () => ({
      ok: true,
      runtime: "forgets",
    }));
    app.post("/echo", async (ctx) => ({
      method: ctx.method,
      path: ctx.path,
      query: ctx.query.name,
      header: ctx.headers["x-test"],
      body: await ctx.text(),
    }));

    const server = createFastifyHttpDriver(app).buildServer();

    const health = await server.inject({
      method: "GET",
      url: "/healthz",
    });
    expect(health.statusCode).toBe(200);
    expect(health.headers["content-type"]).toContain("application/json");
    expect(health.body).toBe('{"ok":true,"runtime":"forgets"}');

    const echo = await server.inject({
      method: "POST",
      url: "/echo?name=Ada",
      headers: {
        "content-type": "text/plain",
        "x-test": "native",
      },
      payload: "hello",
    });
    expect(echo.statusCode).toBe(200);
    expect(echo.body).toBe(
      '{"method":"POST","path":"/echo","query":"Ada","header":"native","body":"hello"}',
    );

    await server.close();
  });

  it("normalizes Fastify 404 responses through forgets", async () => {
    const app = createApp();
    const server = createFastifyHttpDriver(app).buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toBe(
      '{"error":{"code":"FORGETS_NOT_FOUND","message":"Route not found","status":404}}',
    );

    await server.close();
  });

  it("dispatches an exact route with context values", async () => {
    const app = createApp();
    app.post("/echo", async (ctx) => ({
      method: ctx.method,
      path: ctx.path,
      query: ctx.query.name,
      header: ctx.headers["x-test"],
      body: await ctx.text(),
    }));

    const transport = new MemoryTransport({
      id: 42,
      method: "POST",
      path: "/echo",
      query: "name=Ada",
      headers: { "x-test": "native" },
      body: "hello",
    });

    await createTransportHttpDriver(app, { transport }).handle(42);

    expect(transport.responses).toEqual([
      {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: "POST",
          path: "/echo",
          query: "Ada",
          header: "native",
          body: "hello",
        }),
      },
    ]);
  });

  it("returns 404 when no route matches", async () => {
    const app = createApp();
    const transport = new MemoryTransport({
      id: 7,
      method: "GET",
      path: "/missing",
      query: "",
      headers: {},
      body: "",
    });

    await createTransportHttpDriver(app, { transport }).handle(7);

    expect(transport.responses).toEqual([
      {
        status: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: {
            code: "FORGETS_NOT_FOUND",
            message: "Route not found",
            status: 404,
          },
        }),
      },
    ]);
  });
});

describe("createPerryHttpTransport", () => {
  it("adapts Perry HTTP primitives through explicit i64/string ABI wrappers", () => {
    const writes: NativeWriteResponse[] = [];
    const primitives: PerryHttpPrimitives = {
      createServer: (port) => port + 10,
      accept: (server) => server + 20,
      requestMethod: () => "POST",
      requestPath: () => "/echo",
      requestQuery: () => "name=Ada",
      requestHeadersAll: () => '{"x-test":"native"}',
      requestBody: () => "hello",
      respondWithHeaders: (_request, status, body, headersJson) => {
        writes.push({
          status,
          body,
          headers: JSON.parse(headersJson) as Record<string, string>,
        });
        return true;
      },
    };

    const transport = createPerryHttpTransport(primitives);

    expect(transport.createServer(43101)).toBe(43111);
    expect(transport.accept(43111)).toBe(43131);
    expect(transport.snapshot(1)).toEqual({
      id: 1,
      method: "POST",
      path: "/echo",
      query: "name=Ada",
      headers: { "x-test": "native" },
      body: "hello",
    });

    expect(
      transport.respond(1, {
        status: 201,
        headers: { "content-type": "application/json" },
        body: '{"ok":true}',
      }),
    ).toBe(true);
    expect(writes).toEqual([
      {
        status: 201,
        headers: { "content-type": "application/json" },
        body: '{"ok":true}',
      },
    ]);
  });
});
