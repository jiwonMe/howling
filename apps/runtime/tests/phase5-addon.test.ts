import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NODE_CATALOG_VERSION } from "@howling/contracts";

const addon = join(dirname(fileURLToPath(import.meta.url)), "../../../infra/ha-addon");

describe("HA OS addon packaging", () => {
  it("declares ingress, supervisor APIs, and /data", () => {
    const config = readFileSync(join(addon, "config.yaml"), "utf8");
    expect(config).toContain("ingress: true");
    expect(config).toContain("homeassistant_api: true");
    expect(config).toContain("hassio_api: true");
    expect(config).toContain("type: data");
  });

  it("pins the same node catalog as contracts", () => {
    const manifest = JSON.parse(readFileSync(join(addon, "manifest.json"), "utf8")) as {
      nodeCatalogVersion: string;
      protocolVersion: number;
    };
    expect(manifest.nodeCatalogVersion).toBe(NODE_CATALOG_VERSION);
    expect(manifest.protocolVersion).toBe(1);
  });
});
