import {
  isHttpError,
  normalizeResponse,
  type Middleware,
} from "../../http/src/index";

export interface AccessLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId?: string;
}

export interface AccessLogOptions {
  now?: () => number;
}

export type AccessLogSink = (entry: AccessLogEntry) => void;

export function accessLog(
  sink: AccessLogSink,
  options: AccessLogOptions = {},
): Middleware {
  const now = options.now ?? Date.now;

  return (next) => async (ctx) => {
    const startedAt = now();

    try {
      const value = await next(ctx);
      sink(createEntry(
        ctx.method,
        ctx.path,
        normalizeResponse(value).status,
        now() - startedAt,
        ctx.state.requestId,
      ));
      return value;
    } catch (error) {
      const status = isHttpError(error) ? error.status : 500;
      sink(createEntry(
        ctx.method,
        ctx.path,
        status,
        now() - startedAt,
        ctx.state.requestId,
      ));
      throw error;
    }
  };
}

function createEntry(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  requestId: unknown,
): AccessLogEntry {
  const entry: AccessLogEntry = {
    method,
    path,
    status,
    durationMs: Math.max(0, durationMs),
  };

  if (requestId !== undefined) {
    entry.requestId = String(requestId);
  }

  return entry;
}
