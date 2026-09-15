import { describe, expect, it } from "vitest";
import {
  DEVICE_INTEGRATIONS,
  MCP_TOOL_SCOPES,
  VIRTUAL_DEVICE,
  actionsOf,
  deviceActionInvokeSchema,
  deviceActionRequestSchema,
  deviceActionResultSchema,
  deviceCreateBodySchema,
  deviceCreateResultSchema,
  deviceDeleteRequestSchema,
  deviceDeleteResultSchema,
  deviceUpdateBodySchema,
  deviceUpdateRequestSchema,
  deviceIntegrateBodySchema,
  deviceIntegrateResultSchema,
  deviceSummarySchema,
  devicesSnapshotSchema,
  fieldsOf,
  onDeviceBoard,
  originLabel,
  originOf,
  productPartsOf,
  readingOf,
  reservedRuntimeMessageTypes,
  stateLabel,
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
    expect(originOf(parsed)).toBe("ha");
    expect(originLabel({ origin: "virtual" })).toBe("가상");
    expect(
      deviceSummarySchema.parse({
        id: "dev_tv",
        name: "작업실 TV",
        kind: "player",
        actions: [],
        numeric: false,
        available: true,
        origin: "virtual",
      }).origin,
    ).toBe("virtual");
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
    expect(
      deviceSummarySchema.parse({
        id: "dev_abc",
        name: "Test Power",
        kind: "number",
        actions: [],
        numeric: true,
        available: true,
        state: "800",
      }).state,
    ).toBe("800");
    expect(() =>
      deviceSummarySchema.parse({
        id: "dev_abc",
        name: "TV",
        kind: "player",
        actions: [],
        numeric: false,
        available: true,
        state: "media_player.living",
      }),
    ).toThrow();
    expect(stateLabel("playing")).toBe("재생 중");
    expect(readingOf("player", { volume_level: 0.4 })).toBe("볼륨 40%");
    expect(onDeviceBoard("sensor")).toBe(false);
  });

  it("parses a device action request and rejects entity ids in data", () => {
    const parsed = deviceActionRequestSchema.parse({
      deviceId: "dev_abc",
      action: "play_media",
      data: { media_content_id: "app:youtube", media_content_type: "app" },
    });
    expect(parsed.action).toBe("play_media");
    expect(() =>
      deviceActionRequestSchema.parse({
        deviceId: "dev_abc",
        action: "turn_on",
        data: { entity_id: "media_player.living" },
      }),
    ).toThrow();
    expect(fieldsOf("player", "play_media").map((item) => item.key)).toEqual([
      "media_content_id",
      "media_content_type",
    ]);
    expect(fieldsOf("remote", "send_command")[0]?.key).toBe("command");
    expect(actionsOf("player")).toContain("play_media");
    expect(productPartsOf("Apple TV")?.map((item) => item.kind)).toEqual(["player", "remote", "binary"]);
    expect(JSON.stringify(productPartsOf("apple_tv"))).not.toContain("media_player");
  });

  it("reserves devices.snapshot and scopes list_devices", () => {
    expect(reservedRuntimeMessageTypes).toContain("devices.snapshot");
    expect(reservedRuntimeMessageTypes).toContain("devices.create");
    expect(reservedRuntimeMessageTypes).toContain("devices.created");
    expect(reservedRuntimeMessageTypes).toContain("devices.integrate");
    expect(reservedRuntimeMessageTypes).toContain("devices.integrated");
    expect(reservedRuntimeMessageTypes).toContain("devices.action");
    expect(reservedRuntimeMessageTypes).toContain("devices.acted");
    expect(reservedRuntimeMessageTypes).toContain("devices.update");
    expect(reservedRuntimeMessageTypes).toContain("devices.updated");
    expect(reservedRuntimeMessageTypes).toContain("devices.delete");
    expect(reservedRuntimeMessageTypes).toContain("devices.deleted");
    expect(
      deviceActionInvokeSchema.parse({ requestId: "req_a", deviceId: "dev_abc", action: "turn_off" })
        .action,
    ).toBe("turn_off");
    expect(() =>
      deviceActionResultSchema.parse({
        requestId: "req_a",
        entityId: "input_boolean.living",
      }),
    ).toThrow();
    expect(MCP_TOOL_SCOPES.list_devices).toEqual(["read"]);
    expect(MCP_TOOL_SCOPES.create_device).toEqual(["edit"]);
    expect(MCP_TOOL_SCOPES.update_device).toEqual(["edit"]);
    expect(MCP_TOOL_SCOPES.delete_device).toEqual(["edit"]);
    expect(deviceUpdateBodySchema.parse({ name: "  작업실 TV  " })).toEqual({ name: "작업실 TV" });
    expect(deviceUpdateBodySchema.safeParse({ name: "media_player.living" }).success).toBe(false);
    expect(
      deviceUpdateRequestSchema.parse({ requestId: "req_u", deviceId: "dev_tv", name: "작업실 TV" })
        .deviceId,
    ).toBe("dev_tv");
    expect(deviceDeleteRequestSchema.parse({ requestId: "req_d", deviceId: "dev_tv" }).deviceId).toBe(
      "dev_tv",
    );
    expect(() =>
      deviceDeleteResultSchema.parse({ requestId: "req_d", entityId: "input_boolean.x" }),
    ).toThrow();
    const snap = devicesSnapshotSchema.parse({ devices: [] });
    expect(snap.devices).toEqual([]);
  });

  it("parses a create body and rejects entityId on the result", () => {
    expect(deviceCreateBodySchema.parse({ name: "  거실 스위치  ", kind: "boolean" })).toEqual({
      name: "거실 스위치",
      kind: "boolean",
    });
    expect(deviceCreateBodySchema.parse({ name: "작업실 TV", product: "apple_tv" }).product).toBe(
      "apple_tv",
    );
    expect(deviceCreateBodySchema.safeParse({ name: "TV" }).success).toBe(false);
    expect(deviceCreateBodySchema.safeParse({ name: "TV", kind: "player", product: "apple_tv" }).success).toBe(
      false,
    );
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
    expect(
      deviceSummarySchema.parse({
        id: "dev_fridge",
        name: "주방 냉장고",
        kind: "climate",
        actions: ["turn_on", "turn_off"],
        numeric: false,
        available: true,
      }).kind,
    ).toBe("climate");
    expect(deviceActionRequestSchema.parse({ deviceId: "dev_c", action: "open" }).action).toBe("open");
    expect(DEVICE_INTEGRATIONS.some((item) => item.id === "hue")).toBe(true);
    expect(DEVICE_INTEGRATIONS.some((item) => item.id === "apple_tv")).toBe(true);
    expect(DEVICE_INTEGRATIONS.some((item) => item.id === "lg_thinq")).toBe(true);
    expect(JSON.stringify(DEVICE_INTEGRATIONS)).not.toContain("entity_id");
  });
});
