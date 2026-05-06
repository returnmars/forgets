import {
  HttpError,
  normalizeResponse,
  type App,
  type InspectedRoute,
  type NormalizedResponse,
} from "../../http/src/index";
import {
  createContext,
  responseBodyToString,
  type NativeHttpRequestSnapshot,
  type NativeWriteResponse,
} from "./context";

export type { NativeHttpRequestSnapshot, NativeWriteResponse } from "./context";

export interface NativeHttpTransport {
  createServer(port: number): number;
  accept(server: number): number;
  snapshot(request: number): NativeHttpRequestSnapshot;
  respond(request: number, response: NativeWriteResponse): boolean;
}

export interface NativeHttpDriverOptions {
  transport?: NativeHttpTransport;
}

export interface TransportHttpDriver {
  listen(port: number): Promise<void>;
  handle(request: number): Promise<void>;
}

export interface PerryHttpPrimitives {
  createServer(port: number): number;
  accept(server: number): number;
  requestMethod(request: number): string;
  requestPath(request: number): string;
  requestQuery(request: number): string;
  requestHeadersAll(request: number): string;
  requestBody(request: number): string;
  respondWithHeaders(
    request: number,
    status: number,
    body: string,
    headersJson: string,
  ): boolean;
}

export function createTransportHttpDriver(
  app: App,
  options: NativeHttpDriverOptions = {},
): TransportHttpDriver {
  const transport = options.transport ?? createPerryHttpTransport();
  const routes = app.inspectRoutes();

  async function handle(request: number): Promise<void> {
    const snapshot = transport.snapshot(request);
    const matched = findRoute(routes, snapshot.method, snapshot.path);

    if (!matched) {
      writeNormalized(
        transport,
        request,
        normalizeResponse(
          HttpError.notFound("Route not found", { code: "FORGETS_NOT_FOUND" }),
        ),
      );
      return;
    }

    const responseHeaders: Record<string, string> = {};
    const ctx = createContext(snapshot, responseHeaders);
    const value = await matched.route.handler(ctx);
    const response = normalizeResponse(value);

    writeNormalized(transport, request, {
      ...response,
      headers: { ...response.headers, ...responseHeaders },
    });
  }

  return {
    async listen(port) {
      const server = transport.createServer(port);
      console.log(`forgets ready port=${port}`);

      while (true) {
        const request = transport.accept(server);
        if (request >= 0) {
          await handle(request);
        }
      }
    },
    handle,
  };
}

function findRoute(
  routes: InspectedRoute[],
  method: string,
  path: string,
): InspectedRoute | undefined {
  const normalizedMethod = method.toUpperCase();

  for (const route of routes) {
    if (route.method === normalizedMethod && route.path === path) {
      return route;
    }
  }

  return undefined;
}

function writeNormalized(
  transport: NativeHttpTransport,
  request: number,
  response: NormalizedResponse,
): void {
  transport.respond(request, {
    status: response.status,
    headers: response.headers,
    body: responseBodyToString(response.body),
  });
}

declare function js_http_server_create(port: number): number;
declare function js_http_server_accept_v2(server: number): number;
declare function js_http_request_method(request: number): string;
declare function js_http_request_path(request: number): string;
declare function js_http_request_query(request: number): string;
declare function js_http_request_headers_all(request: number): string;
declare function js_http_request_body(request: number): string;
declare function js_http_respond_with_headers(
  request: number,
  status: number,
  body: string,
  headersJson: string,
): boolean;

const defaultPerryHttpPrimitives: PerryHttpPrimitives = {
  createServer(port) {
    return js_http_server_create(port);
  },
  accept(server) {
    return js_http_server_accept_v2(server);
  },
  requestMethod(request) {
    return js_http_request_method(request);
  },
  requestPath(request) {
    return js_http_request_path(request);
  },
  requestQuery(request) {
    return js_http_request_query(request);
  },
  requestHeadersAll(request) {
    return js_http_request_headers_all(request);
  },
  requestBody(request) {
    return js_http_request_body(request);
  },
  respondWithHeaders(request, status, body, headersJson) {
    return js_http_respond_with_headers(request, status, body, headersJson);
  },
};

export function createPerryHttpTransport(
  primitives: PerryHttpPrimitives = defaultPerryHttpPrimitives,
): NativeHttpTransport {
  return {
    createServer(port) {
      return primitives.createServer(port);
    },
    accept(server) {
      return primitives.accept(server);
    },
    snapshot(request) {
      return {
        id: request,
        method: primitives.requestMethod(request),
        path: primitives.requestPath(request),
        query: primitives.requestQuery(request),
        headers: parseHeadersJson(primitives.requestHeadersAll(request)),
        body: primitives.requestBody(request),
      };
    },
    respond(request, response) {
      const body: string = response.body;
      const headersJson: string = JSON.stringify(response.headers);
      return primitives.respondWithHeaders(
        request,
        response.status,
        body,
        headersJson,
      );
    },
  };
}

function parseHeadersJson(value: string): Record<string, string> {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as Record<string, string>;
  return parsed;
}
