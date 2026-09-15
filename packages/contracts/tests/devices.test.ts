import { describe, expect, it } from "vitest";
import {
  MCP_TOOL_SCOPES,
  deviceActionRequestSchema,
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
    expect(MCP_TOOL_SCOPES.list_devices).toEqual(["read"]);
    const snap = devicesSnapshotSchema.parse({ devices: [] });
    expect(snap.devices).toEqual([]);
  });
});
