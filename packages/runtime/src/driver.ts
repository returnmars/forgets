import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import {
  HttpError,
  isHttpError,
  normalizeResponse,
  type App,
  type InspectedRoute,
  type NormalizedResponse,
} from "../../http/src/index";
import {
  createContext,
  type NativeHttpRequestSnapshot,
} from "./context";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: unknown;
  }
}

export interface FastifyHttpDriver {
  buildServer(): FastifyInstance;
  listen(port: number): void;
}

export type NativeHttpDriver = FastifyHttpDriver;

interface PerryFastifyRequestMethods {
  query(): Record<string, unknown>;
  rawBody(): string;
}

export function createNativeHttpDriver(app: App): NativeHttpDriver {
  return createFastifyHttpDriver(app);
}

export function createFastifyHttpDriver(app: App): FastifyHttpDriver {
  function buildServer(): FastifyInstance {
    const server = Fastify({ logger: false });
    const routes = app.inspectRoutes();

    for (const inspected of routes) {
      registerFastifyRoute(server, inspected);
    }

    server.setNotFoundHandler(async (_request, reply) => {
      writeFastifyResponse(
        reply,
        normalizeResponse(
          HttpError.notFound("Route not found", { code: "FORGETS_NOT_FOUND" }),
        ),
      );
    });

    return server;
  }

  return {
    buildServer,
    listen(port) {
      const server = Fastify({ logger: false });
      const routes = app.inspectRoutes();

      for (const inspected of routes) {
        switch (inspected.method) {
          case "GET":
            server.get(inspected.path, async (request, reply) => {
              await handleFastifySnapshot(
                inspected,
                {
                  id: 0,
                  method: request.method,
                  path: request.url,
                  query: "",
                  queryObject: request.query as Record<string, string | string[]>,
                  headers: normalizeFastifyHeaders(request.headers),
                  body: bodyToText(request.rawBody),
                },
                normalizeUnknownRecord(request.params),
                reply,
              );
            });
            break;
          case "POST":
            server.post(inspected.path, async (request, reply) => {
              await handleFastifySnapshot(
                inspected,
                {
                  id: 0,
                  method: request.method,
                  path: request.url,
                  query: "",
                  queryObject: request.query as Record<string, string | string[]>,
                  headers: normalizeFastifyHeaders(request.headers),
                  body: bodyToText(request.rawBody),
                },
                normalizeUnknownRecord(request.params),
                reply,
              );
            });
            break;
          case "PUT":
            server.put(inspected.path, async (request, reply) => {
              await handleFastifySnapshot(
                inspected,
                {
                  id: 0,
                  method: request.method,
                  path: request.url,
                  query: "",
                  queryObject: request.query as Record<string, string | string[]>,
                  headers: normalizeFastifyHeaders(request.headers),
                  body: bodyToText(request.rawBody),
                },
                normalizeUnknownRecord(request.params),
                reply,
              );
            });
            break;
          case "PATCH":
            server.patch(inspected.path, async (request, reply) => {
              await handleFastifySnapshot(
                inspected,
                {
                  id: 0,
                  method: request.method,
                  path: request.url,
                  query: "",
                  queryObject: request.query as Record<string, string | string[]>,
                  headers: normalizeFastifyHeaders(request.headers),
                  body: bodyToText(request.rawBody),
                },
                normalizeUnknownRecord(request.params),
                reply,
              );
            });
            break;
          case "DELETE":
            server.delete(inspected.path, async (request, reply) => {
              await handleFastifySnapshot(
                inspected,
                {
                  id: 0,
                  method: request.method,
                  path: request.url,
                  query: "",
                  queryObject: request.query as Record<string, string | string[]>,
                  headers: normalizeFastifyHeaders(request.headers),
                  body: bodyToText(request.rawBody),
                },
                normalizeUnknownRecord(request.params),
                reply,
              );
            });
            break;
          case "HEAD":
            server.head(inspected.path, async (request, reply) => {
              await handleFastifySnapshot(
                inspected,
                {
                  id: 0,
                  method: request.method,
                  path: request.url,
                  query: "",
                  queryObject: request.query as Record<string, string | string[]>,
                  headers: normalizeFastifyHeaders(request.headers),
                  body: bodyToText(request.rawBody),
                },
                normalizeUnknownRecord(request.params),
                reply,
              );
            });
            break;
          case "OPTIONS":
            server.options(inspected.path, async (request, reply) => {
              await handleFastifySnapshot(
                inspected,
                {
                  id: 0,
                  method: request.method,
                  path: request.url,
                  query: "",
                  queryObject: request.query as Record<string, string | string[]>,
                  headers: normalizeFastifyHeaders(request.headers),
                  body: bodyToText(request.rawBody),
                },
                normalizeUnknownRecord(request.params),
                reply,
              );
            });
            break;
        }
      }

      server.setNotFoundHandler(async (_request, reply) => {
        writeFastifyResponse(
          reply,
          normalizeResponse(
            HttpError.notFound("Route not found", { code: "FORGETS_NOT_FOUND" }),
          ),
        );
      });

      server.listen({ port, host: "0.0.0.0" }, () => {
        console.log(`forgets ready port=${port}`);
      });
    },
  };
}

function registerFastifyRoute(
  server: FastifyInstance,
  inspected: InspectedRoute,
): void {
  const handler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    await handleFastifyRequest(inspected, request, reply);
  };

  switch (inspected.method) {
    case "GET":
      server.get(inspected.path, handler);
      break;
    case "POST":
      server.post(inspected.path, handler);
      break;
    case "PUT":
      server.put(inspected.path, handler);
      break;
    case "PATCH":
      server.patch(inspected.path, handler);
      break;
    case "DELETE":
      server.delete(inspected.path, handler);
      break;
    case "HEAD":
      server.head(inspected.path, handler);
      break;
    case "OPTIONS":
      server.options(inspected.path, handler);
      break;
  }
}

async function handleFastifyRequest(
  inspected: InspectedRoute,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await handleFastifySnapshot(
    inspected,
    snapshotFastifyRequest(request),
    normalizeUnknownRecord(request.params),
    reply,
  );
}

async function handleFastifySnapshot(
  inspected: InspectedRoute,
  snapshot: NativeHttpRequestSnapshot,
  params: Record<string, string>,
  reply: FastifyReply,
): Promise<void> {
  const responseHeaders: Record<string, string> = {};
  const ctx = createContext(
    snapshot,
    responseHeaders,
    params,
  );

  try {
    const value = await inspected.handler(ctx);
    const response = normalizeResponse(value);
    writeFastifyResponse(reply, {
      ...response,
      headers: { ...response.headers, ...responseHeaders },
    });
  } catch (error) {
    const response =
      isHttpError(error)
        ? normalizeResponse(error)
        : normalizeResponse(
            HttpError.internal("Internal Server Error", {
              code: "FORGETS_INTERNAL_ERROR",
            }),
          );
    writeFastifyResponse(reply, response);
  }
}

function snapshotFastifyRequest(
  request: FastifyRequest,
): NativeHttpRequestSnapshot {
  const queryStart = request.url.indexOf("?");
  const path = queryStart >= 0 ? request.url.slice(0, queryStart) : request.url;
  const query =
    queryStart >= 0
      ? request.url.slice(queryStart + 1)
      : fastifyRequestQueryToString(request);

  return {
    id: 0,
    method: request.method,
    path,
    query,
    queryObject: request.query as Record<string, string | string[]>,
    headers: normalizeFastifyHeaders(request.headers),
    body: fastifyRequestBodyToText(request),
  };
}

function normalizeFastifyHeaders(
  headers: FastifyRequest["headers"],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const name in headers) {
    const value = headers[name];
    if (Array.isArray(value)) {
      result[name.toLowerCase()] = value.join(", ");
    } else if (value !== undefined) {
      result[name.toLowerCase()] = String(value);
    }
  }

  return result;
}

function normalizeUnknownRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result: Record<string, string> = {};
  const record = value as Record<string, unknown>;
  for (const key in record) {
    const item = record[key];
    if (item !== undefined) {
      result[key] = String(item);
    }
  }

  return result;
}

function queryToString(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const parts: string[] = [];
  const record = value as Record<string, unknown>;
  for (const key in record) {
    const item = record[key];
    if (Array.isArray(item)) {
      for (const entry of item) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(entry))}`);
      }
    } else if (item !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }

  return parts.join("&");
}

function fastifyRequestQueryToString(request: FastifyRequest): string {
  try {
    const nativeQuery = (request as unknown as PerryFastifyRequestMethods).query();
    if (nativeQuery !== undefined && nativeQuery !== null) {
      return queryToString(nativeQuery);
    }
  } catch {
    // npm Fastify exposes query as a property; Perry's native binding also
    // supports a no-arg native method shape.
  }

  return queryToString(request.query);
}

function fastifyRequestBodyToText(request: FastifyRequest): string {
  try {
    const nativeBody = (request as unknown as PerryFastifyRequestMethods).rawBody();
    if (nativeBody !== undefined && nativeBody !== null) {
      return bodyToText(nativeBody);
    }
  } catch {
    // Fall through to npm Fastify's parsed body property.
  }

  const rawBody = request.rawBody;

  if (rawBody !== undefined && rawBody !== null) {
    return bodyToText(rawBody);
  }

  return bodyToText(request.body);
}

function bodyToText(body: unknown): string {
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

function writeFastifyResponse(
  reply: FastifyReply,
  response: NormalizedResponse,
): void {
  reply.code(response.status);

  for (const name in response.headers) {
    reply.header(name, response.headers[name]);
  }

  reply.send(response.body);
}
