import { describe, expect, it } from "vitest";
import {
  DEVICE_INTEGRATIONS,
  MCP_TOOL_SCOPES,
  VIRTUAL_DEVICE,
  deviceActionRequestSchema,
  deviceCreateBodySchema,
  deviceCreateResultSchema,
  deviceIntegrateBodySchema,
  deviceIntegrateResultSchema,
  deviceSummarySchema,
  devicesSnapshotSchema,
  reservedRuntimeMessageTypes,
} from "../src/index.js";

describe("device catalog contracts", () => {
  it("parses a device summary without entityId", () => {
    const parsed = deviceSummarySchema.parse({
      id: "dev_abc",
      name: "Test Power",
      kind: "number",
      actions: [],
      numeric: true,
      available: true,
    });
    expect(parsed.id).toBe("dev_abc");
  });

  it("rejects entityId on a device summary", () => {
    expect(() =>
      deviceSummarySchema.parse({
        id: "dev_abc",
        name: "Test Power",
        kind: "number",
        actions: [],
        numeric: true,
        available: true,
        entityId: "input_number.test_power",
      }),
    ).toThrow();
  });

  it("parses a device action request", () => {
    const parsed = deviceActionRequestSchema.parse({
      deviceId: "dev_abc",
      action: "turn_on",
    });
    expect(parsed.action).toBe("turn_on");
  });

  it("reserves devices.snapshot and scopes list_devices", () => {
    expect(reservedRuntimeMessageTypes).toContain("devices.snapshot");
    expect(reservedRuntimeMessageTypes).toContain("devices.create");
    expect(reservedRuntimeMessageTypes).toContain("devices.created");
    expect(reservedRuntimeMessageTypes).toContain("devices.integrate");
    expect(reservedRuntimeMessageTypes).toContain("devices.integrated");
    expect(MCP_TOOL_SCOPES.list_devices).toEqual(["read"]);
    expect(MCP_TOOL_SCOPES.create_device).toEqual(["edit"]);
    const snap = devicesSnapshotSchema.parse({ devices: [] });
    expect(snap.devices).toEqual([]);
  });

  it("parses a create body and rejects entityId on the result", () => {
    expect(deviceCreateBodySchema.parse({ name: "  거실 스위치  ", kind: "boolean" })).toEqual({
      name: "거실 스위치",
      kind: "boolean",
    });
    expect(() =>
      deviceCreateResultSchema.parse({
        requestId: "req_1",
        entityId: "input_boolean.living",
      }),
    ).toThrow();
    expect(() =>
      deviceIntegrateResultSchema.parse({
        requestId: "req_2",
        status: "done",
        entityId: "light.living_hue",
      }),
    ).toThrow();
    expect(deviceIntegrateBodySchema.safeParse({ integration: "mqtt" }).success).toBe(false);
    expect(deviceIntegrateBodySchema.safeParse({ integration: VIRTUAL_DEVICE.id }).success).toBe(false);
    expect(deviceIntegrateBodySchema.safeParse({}).success).toBe(false);
    expect(deviceIntegrateBodySchema.parse({ integration: "shelly" }).integration).toBe("shelly");
    expect(
      deviceSummarySchema.parse({
        id: "dev_tv",
        name: "거실 TV",
        kind: "player",
        actions: ["turn_on", "turn_off"],
        numeric: false,
        available: true,
      }).kind,
    ).toBe("player");
    expect(DEVICE_INTEGRATIONS.some((item) => item.id === "hue")).toBe(true);
    expect(DEVICE_INTEGRATIONS.some((item) => item.id === "apple_tv")).toBe(true);
    expect(JSON.stringify(DEVICE_INTEGRATIONS)).not.toContain("entity_id");
  });
});
