import type { Middleware } from "../../http/src/index";

export interface RequestIdOptions {
  headerName?: string;
  stateKey?: string;
  generate?: () => string;
}

let requestIdCounter = 0;

export function requestId(options: RequestIdOptions = {}): Middleware {
  const headerName = (options.headerName ?? "x-request-id").toLowerCase();
  const stateKey = options.stateKey ?? "requestId";
  const generate = options.generate ?? defaultRequestId;

  return (next) => async (ctx) => {
    const existing = ctx.headers[headerName];
    const value = existing || generate();

    ctx.state[stateKey] = value;
    ctx.set(headerName, value);

    return next(ctx);
  };
}

function defaultRequestId(): string {
  requestIdCounter += 1;
  return `req_${Date.now().toString(36)}_${requestIdCounter.toString(36)}`;
}
