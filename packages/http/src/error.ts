export interface HttpErrorOptions {
  code?: string;
  details?: unknown;
}

export interface HttpErrorLike extends Record<string, unknown> {
  name?: string;
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = options.code ?? `HTTP_${status}`;
    this.details = options.details;
  }

  static badRequest(message = "Bad Request", options: HttpErrorOptions = {}) {
    return new HttpError(400, message, options);
  }

  static unauthorized(message = "Unauthorized", options: HttpErrorOptions = {}) {
    return new HttpError(401, message, options);
  }

  static notFound(message = "Not Found", options: HttpErrorOptions = {}) {
    return new HttpError(404, message, options);
  }

  static internal(
    message = "Internal Server Error",
    options: HttpErrorOptions = {},
  ) {
    return new HttpError(500, message, options);
  }
}

export function isHttpError(value: unknown): value is HttpErrorLike {
  if (value instanceof HttpError) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.name === "HttpError" &&
    typeof record.status === "number" &&
    record.status >= 400 &&
    record.status <= 599 &&
    typeof record.code === "string" &&
    typeof record.message === "string"
  );
}
