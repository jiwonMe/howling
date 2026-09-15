import { describe, expect, it } from "vitest";
import { deviceSummarySchema } from "@howling/contracts";
import { classifyEntity, displayNameOf } from "../src/devices/classify.js";
import { reportDevices } from "../src/devices/report.js";
import {
  deviceIdOf,
  listDevices,
  summariesOf,
  syncDeviceCatalog,
  upsertDevices,
} from "../src/devices/store.js";
import type { GatewayHandle } from "../src/gateway/client.js";
import { openTestDb } from "./helpers.js";

const runtimeId = "runtime_dev";

const fakeGateway = (sent: { type: string; payload: unknown }[]): GatewayHandle => ({
  stop: () => undefined,
  send: (type, payload) => {
    sent.push({ type, payload });
    return true;
  },
  runtimeId: () => runtimeId,
  hold: () => undefined,
  release: () => undefined,
  setIdentity: () => undefined,
  setConnectors: () => undefined,
});

describe("phase 6 device catalog", () => {
  it("classifies domains and hides the entity id in the name", () => {
    expect(classifyEntity("input_number.test_power", "800")?.kind).toBe("number");
    expect(classifyEntity("input_boolean.test_alert", "off")?.actions).toContain("turn_on");
    expect(classifyEntity("media_player.living", "idle")?.kind).toBe("player");
    expect(classifyEntity("media_player.living", "idle")?.actions).toContain("play_media");
    expect(classifyEntity("climate.kitchen_fridge", "cool")?.kind).toBe("climate");
    expect(classifyEntity("climate.kitchen_fridge", "cool")?.actions).toContain("set_temperature");
    expect(classifyEntity("cover.blind", "open")?.actions).toEqual(
      expect.arrayContaining(["open", "close", "stop", "toggle", "set_cover_position"]),
    );
    expect(classifyEntity("lock.door", "locked")?.actions).toEqual(
      expect.arrayContaining(["lock", "unlock", "open"]),
    );
    expect(classifyEntity("vacuum.roomba", "docked")?.actions).toEqual(
      expect.arrayContaining(["start", "pause", "stop", "dock", "locate"]),
    );
    expect(classifyEntity("binary_sensor.fridge_door", "on")).toEqual({
      kind: "binary",
      actions: [],
      numeric: false,
    });
    expect(classifyEntity("sensor.fridge_mode", "express")?.kind).toBe("sensor");
    expect(classifyEntity("sun.sun", "above_horizon")).toBeUndefined();
    expect(displayNameOf("input_number.test_power", "Test Power")).toBe("Test Power");
    expect(displayNameOf("input_number.test_power")).toBe("test power");
  });

  it("keeps the same id across syncs and pairing runtime ids", () => {
    const first = deviceIdOf(runtimeId, "input_number.test_power");
    const second = deviceIdOf(runtimeId, "input_number.test_power");
    expect(first).toBe(second);
    expect(first.startsWith("dev_")).toBe(true);
    expect(first).not.toContain("input_number");
    const { db } = openTestDb();
    upsertDevices(db, runtimeId, [
      { entityId: "input_number.test_power", state: "1", friendlyName: "Test Power" },
    ]);
    upsertDevices(db, "runtime_after_pair", [
      { entityId: "input_number.test_power", state: "2", friendlyName: "Test Power" },
    ]);
    const rows = listDevices(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(first);
    expect(rows[0]?.numeric).toBe(true);
    expect(rows[0]?.state).toBe("2");
    db.close();
  });

  it("reports summaries without entityId", () => {
    const { db } = openTestDb();
    upsertDevices(db, runtimeId, [
      { entityId: "input_number.test_power", state: "0", friendlyName: "Test Power" },
    ]);
    const sent: { type: string; payload: unknown }[] = [];
    reportDevices(fakeGateway(sent), db);
    const payload = sent[0]?.payload as { devices: Record<string, unknown>[] };
    expect(sent[0]?.type).toBe("devices.snapshot");
    expect(payload.devices[0]).toEqual(
      deviceSummarySchema.parse(summariesOf(listDevices(db))[0]),
    );
    expect(JSON.stringify(payload)).not.toContain("input_number");
    expect(JSON.stringify(payload)).not.toContain("entityId");
    expect(payload.devices[0]?.state).toBe("0");
    expect(payload.devices[0]?.origin).toBe("ha");
    upsertDevices(db, runtimeId, [
      {
        entityId: "media_player.living",
        state: "playing",
        friendlyName: "거실 TV",
        attrs: { volume_level: 0.4 },
      },
    ]);
    const player = summariesOf(listDevices(db)).find((item) => item.name === "거실 TV");
    expect(player?.state).toBe("playing");
    expect(player?.reading).toBe("볼륨 40%");
    expect(player?.origin).toBe("ha");
    expect(JSON.stringify(player)).not.toContain("media_player");
    db.close();
  });

  it("marks devices missing from a full catalog as unavailable", () => {
    const { db } = openTestDb();
    syncDeviceCatalog(db, runtimeId, [
      { entityId: "input_number.test_power", state: "1", friendlyName: "Test Power" },
      { entityId: "light.kitchen", state: "on", friendlyName: "Kitchen" },
    ]);
    syncDeviceCatalog(db, runtimeId, [
      { entityId: "input_number.test_power", state: "2", friendlyName: "Test Power" },
    ]);
    const kitchen = listDevices(db).find((row) => row.name === "Kitchen");
    expect(kitchen?.available).toBe(false);
    db.close();
  });
});
