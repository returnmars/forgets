import { route } from "./route";
import type {
  Handler,
  HttpMethod,
  Middleware,
  RouteDefinition,
  RouteEntry,
  RouteOptions,
} from "./types";

export interface InspectedRoute {
  method: HttpMethod;
  path: string;
  route: RouteDefinition;
}

export interface App {
  use(middleware: Middleware): void;
  route(
    method: HttpMethod,
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): void;
  get(path: string, handler: Handler, options?: RouteOptions): void;
  post(path: string, handler: Handler, options?: RouteOptions): void;
  routes(routes: RouteEntry | RouteEntry[]): void;
  inspectRoutes(): InspectedRoute[];
}

export function createApp(): App {
  const middleware: Middleware[] = [];
  const registered: InspectedRoute[] = [];
  const keys = new Set<string>();

  function addRoute(prefix: string, entry: RouteEntry): void {
    if (entry.kind === "group") {
      for (const child of entry.routes) {
        addRoute(joinPaths(prefix, entry.prefix), child);
      }
      return;
    }

    const path = joinPaths(prefix, entry.path);
    const key = `${entry.method} ${path}`;

    if (keys.has(key)) {
      throw new Error(`Duplicate route: ${key}`);
    }

    keys.add(key);
    registered.push({ method: entry.method, path, route: entry });
  }

  return {
    use(next) {
      middleware.push(next);
    },
    route(method, path, handler, options) {
      addRoute("", { ...route.get(path, handler, options), method });
    },
    get(path, handler, options) {
      addRoute("", route.get(path, handler, options));
    },
    post(path, handler, options) {
      addRoute("", route.post(path, handler, options));
    },
    routes(input) {
      const entries = Array.isArray(input) ? input : [input];
      for (const entry of entries) {
        addRoute("", entry);
      }
    },
    inspectRoutes() {
      return [...registered];
    },
  };
}

export function joinPaths(prefix: string, path: string): string {
  const left = prefix === "/" ? "" : prefix.replace(/\/+$/, "");
  const right = path === "/" ? "" : path.replace(/^\/+/, "");
  const joined = `${left}/${right}`.replace(/\/+/g, "/");
  return joined === "" ? "/" : joined;
}
