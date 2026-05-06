import { describe, expect, it } from "vitest";
import { generatePerryEntry } from "../src/index";

describe("generatePerryEntry", () => {
  it("generates a single Perry entry file", () => {
    expect(generatePerryEntry({
      serverImport: "../src/server",
      serverExport: "buildServer",
    })).toContain("await app.listen(config.PORT);");
  });
});
