import { isHttpError } from "./error";
import type { ResponseBuilder } from "./types";

export interface NormalizedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export function normalizeResponse(value: unknown): NormalizedResponse {
  if (isHttpError(value)) {
    return json(value.status, {
      error: {
        code: value.code,
        message: value.message,
        status: value.status,
      },
    });
  }

  if (value === undefined) {
    return { status: 204, headers: {}, body: undefined };
  }

  if (isResponseBuilder(value)) {
    return normalizeResponseBuilder(value);
  }

  if (typeof value === "string") {
    return {
      status: 200,
      headers: { "content-type": "text/plain" },
      body: value,
    };
  }

  if (value instanceof Uint8Array) {
    return {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
      body: value,
    };
  }

  return json(200, value);
}

function normalizeResponseBuilder(value: ResponseBuilder): NormalizedResponse {
  if (value.body === undefined) {
    return {
      status: value.statusCode,
      headers: { ...value.headers },
      body: undefined,
    };
  }

  const body = normalizeResponse(value.body);
  return {
    status: value.statusCode,
    headers: { ...body.headers, ...value.headers },
    body: body.body,
  };
}

function isResponseBuilder(value: unknown): value is ResponseBuilder {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.statusCode === "number" &&
    record.headers !== null &&
    typeof record.headers === "object" &&
    !Array.isArray(record.headers) &&
    "body" in record
  );
}

function json(status: number, value: unknown): NormalizedResponse {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}
