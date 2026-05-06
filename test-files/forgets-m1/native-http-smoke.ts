import { createApp, HttpError } from "../../packages/http/src/index";
import {
  accessLog,
  bodyLimit,
  recovery,
  requestId,
  timeout,
  type AccessLogEntry,
} from "../../packages/middleware/src/index";
import { createNativeHttpDriver } from "../../packages/runtime/src/index";

const port = Number(process.argv[2] || "43101");
const mode = String(process.argv[3] || "smoke");

if (mode === "busy") {
  const busyApp = createApp();
  busyApp.get("/busy", () => ({ ok: true }));

  await createNativeHttpDriver(busyApp, {
    schedulerOptions: {
      maxConcurrentRequests: 0,
      requestQueueLimit: 0,
    },
  }).listen(port);
} else {
  const app = createApp();
  const logs: AccessLogEntry[] = [];
  let slowStarted = false;

  app.use(requestId({ generate: () => "req_native" }));
  app.use(accessLog((entry) => {
    logs.push(entry);
  }));
  app.use(recovery());

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

  app.get("/users/:id", (ctx) => ({
    id: ctx.params.id,
  }));

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

  app.get("/request-id", (ctx) => ({
    requestId: String(ctx.state.requestId),
  }));

  app.get("/recovery", () => {
    throw new Error("boom");
  });

  app.post("/limited", async (ctx) => ({
    body: await ctx.text(),
  }), {
    middleware: [bodyLimit(4)],
  });

  app.get("/timeout", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { ok: true };
  }, {
    middleware: [timeout(10)],
  });

  app.get("/slow-started", () => ({
    started: slowStarted,
  }));

  app.get("/slow", async (ctx) => {
    ctx.state.marker = "slow";
    slowStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    slowStarted = false;

    return {
      marker: String(ctx.state.marker),
      token: String(ctx.query.token),
    };
  });

  app.get("/fast", (ctx) => {
    ctx.state.marker = "fast";

    return {
      marker: String(ctx.state.marker),
      token: String(ctx.query.token),
    };
  });

  app.get("/logs", () => {
    const last = logs[logs.length - 1];

    if (last === undefined) {
      return { count: logs.length };
    }

    return {
      count: logs.length,
      lastPath: last.path,
      lastStatus: last.status,
      lastRequestId: last.requestId,
    };
  });

  await createNativeHttpDriver(app).listen(port);
}
