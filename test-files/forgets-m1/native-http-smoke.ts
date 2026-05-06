import { createApp } from "../../packages/http/src/index";
import { createNativeHttpDriver } from "../../packages/runtime/src/index";

const port = Number(process.argv[2] || "43101");

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

await createNativeHttpDriver(app).listen(port);
