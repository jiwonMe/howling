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
