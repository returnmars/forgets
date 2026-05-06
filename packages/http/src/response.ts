import { HttpError } from "./error";

export interface NormalizedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export function normalizeResponse(value: unknown): NormalizedResponse {
  if (value instanceof HttpError) {
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

function json(status: number, value: unknown): NormalizedResponse {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}
