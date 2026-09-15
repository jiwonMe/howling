import { describe, expect, it } from "vitest";
import { handleDevicesAction } from "../src/devices/act.js";
import { handleDevicesCreate } from "../src/devices/create.js";
import { deviceIdOf, listDevices, summariesOf, upsertDevices } from "../src/devices/store.js";
import type { HaHandle } from "../src/ha/client.js";
import { openTestDb } from "./helpers.js";

const haOf = (callService: HaHandle["callService"]): HaHandle => ({
  status: () => "ready",
  lastSyncAt: () => null,
  callService,
  request: async () => ({}),
  rest: async () => ({}),
  stop: () => undefined,
});

describe("phase 6 device act", () => {
  it("turns a virtual switch without calling HA", async () => {
    const { db } = openTestDb();
    const created = await handleDevicesCreate(
      { db, runtimeId: "runtime_dev" },
      { requestId: "req_sw", name: "시험 스위치", kind: "switch" },
    );
    const device = created.devices?.[0];
    expect(device?.state).toBe("off");
    const events: { state: string }[] = [];
    const acted = await handleDevicesAction(
      {
        db,
        ha: haOf(async () => {
          throw new Error("virtual must not call HA");
        }),
        onEvent: (event) => events.push(event),
      },
      { requestId: "req_on", deviceId: device?.id ?? "", action: "turn_on" },
    );
    expect(acted.device?.state).toBe("on");
    expect(events[0]?.state).toBe("on");
    expect(JSON.stringify(acted)).not.toContain("entityId");
    db.close();
  });

  it("calls HA for a home switch and keeps entity ids out of the summary", async () => {
    const { db } = openTestDb();
    const deviceId = deviceIdOf("runtime_dev", "input_boolean.test_alert");
    upsertDevices(db, "runtime_dev", [
      { entityId: "input_boolean.test_alert", state: "off", friendlyName: "Test Alert" },
    ]);
    const calls: { domain: string; service: string }[] = [];
    const acted = await handleDevicesAction(
      {
        db,
        ha: haOf(async (domain, service) => {
          calls.push({ domain, service });
          return {};
        }),
      },
      { requestId: "req_ha", deviceId, action: "turn_on" },
    );
    expect(calls).toEqual([{ domain: "input_boolean", service: "turn_on" }]);
    expect(acted.device?.state).toBe("on");
    expect(JSON.stringify(acted)).not.toContain("input_boolean");
    expect(summariesOf(listDevices(db))[0]?.state).toBe("on");
    db.close();
  });
});
