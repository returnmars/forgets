import {
  HttpError,
  isHttpError,
  type Context,
  type Middleware,
} from "../../http/src/index";

export interface BodyLimitOptions {
  code?: string;
  message?: string;
}

export function bodyLimit(maxBytes: number, options: BodyLimitOptions = {}): Middleware {
  const code = options.code ?? "FORGETS_BODY_TOO_LARGE";
  const message = options.message ?? "Payload Too Large";

  return (next) => async (ctx) => {
    const contentLength = Number(ctx.headers["content-length"] ?? "0");
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return tooLarge(message, code);
    }

    wrapBodyReaders(ctx, maxBytes, message, code);
    try {
      return await next(ctx);
    } catch (error) {
      if (isHttpError(error)) {
        return error;
      }

      throw error;
    }
  };
}

function wrapBodyReaders(
  ctx: Context,
  maxBytes: number,
  message: string,
  code: string,
): void {
  const originalText = ctx.text.bind(ctx);
  const originalBytes = ctx.bytes.bind(ctx);
  const originalJson = ctx.json.bind(ctx);

  ctx.text = async () => {
    const value = await originalText();
    assertSize(new TextEncoder().encode(value).byteLength, maxBytes, message, code);
    return value;
  };

  ctx.bytes = async () => {
    const value = await originalBytes();
    assertSize(value.byteLength, maxBytes, message, code);
    return value;
  };

  ctx.json = async <T>(schema?: { parse(value: unknown): T }): Promise<T> => {
    const value = await originalJson(schema);
    assertSize(
      new TextEncoder().encode(JSON.stringify(value)).byteLength,
      maxBytes,
      message,
      code,
    );
    return value;
  };
}

function assertSize(
  actualBytes: number,
  maxBytes: number,
  message: string,
  code: string,
): void {
  if (actualBytes > maxBytes) {
    throw tooLarge(message, code);
  }
}

function tooLarge(message: string, code: string): HttpError {
  return new HttpError(413, message, { code });
}
