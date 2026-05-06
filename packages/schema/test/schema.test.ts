import { describe, expect, it } from "vitest";
import { schema } from "../src/index";

describe("schema", () => {
  it("parses objects", () => {
    const User = schema.object({
      id: schema.string(),
      age: schema.number().default(18),
    });

    expect(User.parse({ id: "u1" })).toEqual({ id: "u1", age: 18 });
  });

  it("formats validation errors", () => {
    const User = schema.object({ id: schema.string() });

    expect(() => User.parse({ id: 1 })).toThrow("Expected string at id");
  });
});
