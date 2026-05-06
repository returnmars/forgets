export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface RouteOptions {
  params?: unknown;
  query?: unknown;
  body?: unknown;
  response?: unknown;
  summary?: string;
  description?: string;
  tags?: string[];
  middleware?: Middleware[];
}

export type ResponseValue =
  | undefined
  | null
  | string
  | Uint8Array
  | Record<string, unknown>
  | unknown[]
  | ResponseBuilder;

export interface CancellationSignal {
  aborted: boolean;
  reason?: unknown;
  onAbort(handler: () => void): void;
}

export interface Context {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  state: Record<string, unknown>;
  signal?: CancellationSignal;
  json<T>(schema?: { parse(value: unknown): T }): Promise<T>;
  text(): Promise<string>;
  bytes(): Promise<Uint8Array>;
  status(code: number): ResponseBuilder;
  set(name: string, value: string): void;
}

export interface ResponseBuilder {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export type Handler = (ctx: Context) => Promise<ResponseValue> | ResponseValue;
export type Middleware = (next: Handler) => Handler;

export interface RouteDefinition {
  kind: "route";
  method: HttpMethod;
  path: string;
  handler: Handler;
  options: RouteOptions;
}

export interface RouteGroup {
  kind: "group";
  prefix: string;
  routes: RouteEntry[];
}

export type RouteEntry = RouteDefinition | RouteGroup;
