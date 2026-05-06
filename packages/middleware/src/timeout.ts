import { HttpError, type Middleware, type ResponseValue } from "../../http/src/index";

export interface TimeoutOptions {
  code?: string;
  message?: string;
}

export function timeout(ms: number, options: TimeoutOptions = {}): Middleware {
  const code = options.code ?? "FORGETS_TIMEOUT";
  const message = options.message ?? "Gateway Timeout";

  return (next) => async (ctx) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutResponse = new Promise<ResponseValue>((resolve) => {
      timer = setTimeout(() => {
        resolve(new HttpError(504, message, { code }));
      }, ms);
    });

    try {
      return await Promise.race([timeoutResponse, Promise.resolve(next(ctx))]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  };
}
