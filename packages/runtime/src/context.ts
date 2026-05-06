import type { Context, ResponseBuilder } from "../../http/src/index";

export interface NativeHttpRequestSnapshot {
  id: number;
  method: string;
  path: string;
  query: string;
  queryObject?: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: string;
}

export interface NativeWriteResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function createContext(
  snapshot: NativeHttpRequestSnapshot,
  responseHeaders: Record<string, string>,
  params: Record<string, string> = {},
): Context {
  const headers = normalizeHeaders(snapshot.headers);

  return {
    method: snapshot.method,
    path: snapshot.path,
    params,
    query: snapshot.queryObject ?? parseQuery(snapshot.query),
    headers,
    state: {},
    async json(schema) {
      const parsed = JSON.parse(snapshot.body || "null");
      return schema ? schema.parse(parsed) : parsed;
    },
    async text() {
      return snapshot.body;
    },
    async bytes() {
      return new TextEncoder().encode(snapshot.body);
    },
    status(code): ResponseBuilder {
      return {
        statusCode: code,
        headers: {},
        body: undefined,
      };
    },
    set(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
  };
}

export function responseBodyToString(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  return JSON.stringify(body);
}

function parseQuery(query: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const pair of query.split("&")) {
    if (!pair) continue;

    const [rawKey, rawValue = ""] = pair.split("=");
    const key = decodeQueryPart(rawKey);
    const value = decodeQueryPart(rawValue);
    const existing = result[key];

    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing !== undefined) {
      result[key] = [existing, value];
    } else {
      result[key] = value;
    }
  }

  return result;
}

function decodeQueryPart(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function normalizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const name in headers) {
    result[name.toLowerCase()] = headers[name];
  }

  return result;
}
