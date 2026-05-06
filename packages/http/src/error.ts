export interface HttpErrorOptions {
  code?: string;
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
