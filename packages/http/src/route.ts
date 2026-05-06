import type {
  Handler,
  HttpMethod,
  RouteDefinition,
  RouteEntry,
  RouteGroup,
  RouteOptions,
} from "./types";

function makeRoute(
  method: HttpMethod,
  path: string,
  handler: Handler,
  options: RouteOptions = {},
): RouteDefinition {
  return {
    kind: "route",
    method,
    path,
    handler,
    options,
  };
}

export const route = {
  get: (path: string, handler: Handler, options?: RouteOptions) =>
    makeRoute("GET", path, handler, options),
  post: (path: string, handler: Handler, options?: RouteOptions) =>
    makeRoute("POST", path, handler, options),
  put: (path: string, handler: Handler, options?: RouteOptions) =>
    makeRoute("PUT", path, handler, options),
  patch: (path: string, handler: Handler, options?: RouteOptions) =>
    makeRoute("PATCH", path, handler, options),
  delete: (path: string, handler: Handler, options?: RouteOptions) =>
    makeRoute("DELETE", path, handler, options),
  head: (path: string, handler: Handler, options?: RouteOptions) =>
    makeRoute("HEAD", path, handler, options),
  options: (path: string, handler: Handler, options?: RouteOptions) =>
    makeRoute("OPTIONS", path, handler, options),
};

export function group(prefix: string, routes: RouteEntry[]): RouteGroup {
  return {
    kind: "group",
    prefix,
    routes,
  };
}
