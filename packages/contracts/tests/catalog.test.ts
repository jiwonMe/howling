import { describe, expect, it } from "vitest";
import { NODE_CATALOG_VERSION, officialCatalog } from "../src/index.js";

describe("official node catalog", () => {
  it("lists every core node and keeps the existing version pin", () => {
    expect(NODE_CATALOG_VERSION).toBe("2026.09.1");
    expect(officialCatalog.map((item) => item.type)).toEqual([
      "core.input",
      "analysis.rolling-mean",
      "core.condition",
      "core.effect",
      "core.map",
      "core.delay",
      "core.all",
      "core.any",
    ]);
  });
});
