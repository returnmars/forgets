import { describe, expect, it } from "vitest";
import { inspectStaticRoutes } from "../src/index";

describe("inspectStaticRoutes", () => {
  it("finds static route.get calls inside route factories", () => {
    const source = `
      export function usersRoutes(controller) {
        return group("/users", [
          route.get("/:id", ctx => controller.get(ctx), {
            response: User,
            tags: ["Users"],
          }),
        ]);
      }
    `;

    expect(inspectStaticRoutes(source, "src/users/users.routes.ts")).toEqual([
      {
        method: "GET",
        path: "/users/:id",
        tags: ["Users"],
        source: "src/users/users.routes.ts",
        factory: "usersRoutes",
        index: 0,
      },
    ]);
  });
});
