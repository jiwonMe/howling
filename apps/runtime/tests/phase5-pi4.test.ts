import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pi4 = join(dirname(fileURLToPath(import.meta.url)), "../../../infra/pi4");

describe("Raspberry Pi 4 home image", () => {
  it("runs HA and runtime on the host network", () => {
    const compose = readFileSync(join(pi4, "compose.yaml"), "utf8");
    expect(compose).toContain("ghcr.io/home-assistant/home-assistant:");
    expect(compose).toContain("2025.8.3");
    expect(compose).toContain("howling-runtime:pi4");
    expect(compose).toContain("network_mode: host");
    expect(compose).toContain("wss://app.howling.life/api/v1/runtime/ws");
    expect(compose).toContain("BOOTSTRAP_RUNTIME_TOKEN: \"\"");
  });

  it("pins the same official Raspberry Pi OS Lite 64-bit", () => {
    const manifest = readFileSync(join(pi4, "image/manifest.env"), "utf8");
    expect(manifest).toContain("2026-06-18-raspios-trixie-arm64-lite.img.xz");
    expect(manifest).toContain("raspios_lite_arm64");
    expect(manifest).toContain("HA_IMAGE=ghcr.io/home-assistant/home-assistant:2025.8.3");
  });
});
