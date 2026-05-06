import { HttpError, isHttpError, type Middleware } from "../../http/src/index";

export interface RecoveryOptions {
  code?: string;
  message?: string;
}

export function recovery(options: RecoveryOptions = {}): Middleware {
  const code = options.code ?? "FORGETS_INTERNAL_ERROR";
  const message = options.message ?? "Internal Server Error";

  return (next) => async (ctx) => {
    try {
      return await next(ctx);
    } catch (error) {
      if (isHttpError(error)) {
        return error;
      }

      return HttpError.internal(message, { code });
    }
  };
}
