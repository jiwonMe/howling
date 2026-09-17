import { describe, expect, it } from "vitest";
import type { EffectRequest } from "@howling/core";
import { createDeviceAwareAdapter } from "../src/devices/adapter.js";
import { deviceIdOf, upsertDevices } from "../src/devices/store.js";
import { createFakeAdapter } from "../src/effects/fake-adapter.js";
import { createHaAwareAdapter } from "../src/ha/adapter.js";
import type { HaHandle } from "../src/ha/client.js";
import { openTestDb } from "./helpers.js";

const requestOf = (input: unknown, adapter = "device"): EffectRequest => ({
  id: "eff-1",
  runId: "run-1",
  nodeId: "effect",
  index: 0,
  intent: {
    kind: "external",
    adapter,
    operation: adapter === "device" ? "action" : "call_service",
    input: input as never,
  },
});

describe("phase 6 device adapter", () => {
  it("rewrites a device action into a HA call_service", async () => {
    const { db } = openTestDb();
    const deviceId = deviceIdOf("runtime_dev", "input_boolean.test_alert");
    upsertDevices(db, "runtime_dev", [
      { entityId: "input_boolean.test_alert", state: "off", friendlyName: "Test Alert" },
    ]);
    const calls: { domain: string; service: string; data: Record<string, unknown> }[] = [];
    const ha: HaHandle = {
      status: () => "ready",
      lastSyncAt: () => null,
      callService: async (domain, service, data) => {
        calls.push({ domain, service, data });
        return { ok: true };
      },
      request: async () => {
        throw new Error("not used");
      },
      rest: async () => {
        throw new Error("not used");
      },
      stop: () => undefined,
    };
    const adapter = createDeviceAwareAdapter({
      db,
      next: createHaAwareAdapter({
        fake: createFakeAdapter(),
        ha: () => ha,
        testHooks: true,
      }),
    });
    const result = await adapter.execute(
      requestOf({ deviceId, action: "turn_on" }),
    );
    expect(result).toMatchObject({ status: "succeeded" });
    expect(calls[0]).toEqual({
      domain: "input_boolean",
      service: "turn_on",
      data: { entity_id: "input_boolean.test_alert" },
    });
    db.close();
  });

  it("turns a player on and plays media through media_player", async () => {
    const { db } = openTestDb();
    const deviceId = deviceIdOf("runtime_dev", "media_player.living");
    upsertDevices(db, "runtime_dev", [
      { entityId: "media_player.living", state: "idle", friendlyName: "거실 TV" },
    ]);
    const calls: { domain: string; service: string; data: Record<string, unknown> }[] = [];
    const ha: HaHandle = {
      status: () => "ready",
      lastSyncAt: () => null,
      callService: async (domain, service, data) => {
        calls.push({ domain, service, data });
        return { ok: true };
      },
      request: async () => {
        throw new Error("not used");
      },
      rest: async () => {
        throw new Error("not used");
      },
      stop: () => undefined,
    };
    const adapter = createDeviceAwareAdapter({
      db,
      next: createHaAwareAdapter({
        fake: createFakeAdapter(),
        ha: () => ha,
        testHooks: true,
      }),
    });
    const on = await adapter.execute(requestOf({ deviceId, action: "turn_on" }));
    expect(on).toMatchObject({ status: "succeeded" });
    expect(calls[0]).toEqual({
      domain: "media_player",
      service: "turn_on",
      data: { entity_id: "media_player.living" },
    });
    const play = await adapter.execute(
      requestOf({
        deviceId,
        action: "play_media",
        data: { media_content_id: "app:youtube", media_content_type: "app" },
      }),
    );
    expect(play).toMatchObject({ status: "succeeded" });
    expect(calls[1]).toEqual({
      domain: "media_player",
      service: "play_media",
      data: {
        entity_id: "media_player.living",
        media_content_id: "app:youtube",
        media_content_type: "app",
      },
    });
    db.close();
  });

  it("maps cover open and vacuum dock to hub services", async () => {
    const { db } = openTestDb();
    const coverId = deviceIdOf("runtime_dev", "cover.blind");
    const vacuumId = deviceIdOf("runtime_dev", "vacuum.roomba");
    upsertDevices(db, "runtime_dev", [
      { entityId: "cover.blind", state: "open", friendlyName: "블라인드" },
      { entityId: "vacuum.roomba", state: "docked", friendlyName: "룸바" },
    ]);
    const calls: { domain: string; service: string; data: Record<string, unknown> }[] = [];
    const ha: HaHandle = {
      status: () => "ready",
      lastSyncAt: () => null,
      callService: async (domain, service, data) => {
        calls.push({ domain, service, data });
        return { ok: true };
      },
      request: async () => {
        throw new Error("not used");
      },
      rest: async () => {
        throw new Error("not used");
      },
      stop: () => undefined,
    };
    const adapter = createDeviceAwareAdapter({
      db,
      next: createHaAwareAdapter({
        fake: createFakeAdapter(),
        ha: () => ha,
        testHooks: true,
      }),
    });
    await adapter.execute(requestOf({ deviceId: coverId, action: "open" }));
    await adapter.execute(requestOf({ deviceId: vacuumId, action: "dock" }));
    expect(calls).toEqual([
      { domain: "cover", service: "open_cover", data: { entity_id: "cover.blind" } },
      { domain: "vacuum", service: "return_to_base", data: { entity_id: "vacuum.roomba" } },
    ]);
    db.close();
  });

  it("reads the current state locally without calling the hub", async () => {
    const { db } = openTestDb();
    const switchId = deviceIdOf("runtime_dev", "switch.desk");
    const weatherId = deviceIdOf("runtime_dev", "weather.home");
    const powerId = deviceIdOf("runtime_dev", "input_number.test_power");
    upsertDevices(db, "runtime_dev", [
      { entityId: "switch.desk", state: "off", friendlyName: "작업실 스위치" },
      { entityId: "weather.home", state: "partlycloudy", friendlyName: "Forecast 집" },
      { entityId: "input_number.test_power", state: "800", friendlyName: "Test Power" },
    ]);
    const adapter = createDeviceAwareAdapter({
      db,
      next: createHaAwareAdapter({
        fake: createFakeAdapter(),
        ha: () => undefined,
        testHooks: true,
      }),
    });
    const readOf = (deviceId: string) =>
      adapter.execute({
        ...requestOf({ deviceId }),
        intent: { kind: "external", adapter: "device", operation: "read", input: { deviceId } },
      });
    const off = await readOf(switchId);
    expect(off).toMatchObject({
      status: "succeeded",
      value: { id: switchId, kind: "switch", state: "off", on: false, value: null },
    });
    const weather = await readOf(weatherId);
    expect(weather).toMatchObject({
      status: "succeeded",
      value: { kind: "weather", state: "partlycloudy", on: null },
    });
    const power = await readOf(powerId);
    expect(power).toMatchObject({ status: "succeeded", value: { value: 800, state: "800" } });
    expect(JSON.stringify(power)).not.toContain("input_number");
    expect(JSON.stringify(power)).not.toContain("entityId");
    const missing = await readOf("dev_missing");
    expect(missing).toMatchObject({ status: "unknown", reason: "device missing" });
    db.close();
  });

  it("returns unknown when the device is missing", async () => {
    const { db } = openTestDb();
    const adapter = createDeviceAwareAdapter({
      db,
      next: createHaAwareAdapter({
        fake: createFakeAdapter(),
        ha: () => undefined,
        testHooks: true,
      }),
    });
    const result = await adapter.execute(
      requestOf({ deviceId: "dev_missing", action: "turn_on" }),
    );
    expect(result).toMatchObject({ status: "unknown", reason: "device missing" });
    db.close();
  });
});
