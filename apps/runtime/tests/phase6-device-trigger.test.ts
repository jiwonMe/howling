import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@howling/core";
import { handleDevicesAction } from "../src/devices/act.js";
import { handleDevicesCreate } from "../src/devices/create.js";
import { dispatchDeviceTriggers } from "../src/devices/triggers.js";
import { deviceIdOf, upsertDevices } from "../src/devices/store.js";
import { upsertArtifact } from "../src/store/artifacts.js";
import { createTestHost } from "./helpers.js";

const flow = (id: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id,
  revision: "v1",
  entryNodeId: "input",
  nodes: [{ id: "input", type: "core.input", version: 1, config: {}, inputs: {} }],
  edges: [],
});

describe("phase 6 device triggers", () => {
  it("starts a run from a numeric device change", async () => {
    const host = createTestHost({ seed: false });
    const deviceId = deviceIdOf("runtime_dev", "input_number.test_power");
    upsertDevices(host.db, "runtime_dev", [
      { entityId: "input_number.test_power", state: "0", friendlyName: "Test Power" },
    ]);
    upsertArtifact(host.db, {
      id: "dev-mean",
      definition: flow("dev-mean"),
      connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
      triggers: [
        {
          id: "device-trigger",
          kind: "device.changed",
          connectionId: "ha",
          config: { deviceId, inputKey: "power" },
        },
      ],
    });
    dispatchDeviceTriggers(
      host,
      { entityId: "input_number.test_power", state: "800", previous: "0" },
      false,
    );
    await host.waitIdle();
    const count = host.db.prepare(`SELECT COUNT(*) AS n FROM run_snapshots`).get() as {
      n: number;
    };
    expect(count.n).toBe(1);
    host.stop();
    host.db.close();
  });

  it("starts a run from a binary device change", async () => {
    const host = createTestHost({ seed: false });
    const deviceId = deviceIdOf("runtime_dev", "binary_sensor.fridge_door");
    upsertDevices(host.db, "runtime_dev", [
      { entityId: "binary_sensor.fridge_door", state: "off", friendlyName: "냉장고 문" },
    ]);
    upsertArtifact(host.db, {
      id: "dev-door",
      definition: flow("dev-door"),
      connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
      triggers: [
        {
          id: "device-trigger",
          kind: "device.changed",
          connectionId: "ha",
          config: { deviceId, inputKey: "value" },
        },
      ],
    });
    dispatchDeviceTriggers(
      host,
      { entityId: "binary_sensor.fridge_door", state: "on", previous: "off" },
      false,
    );
    await host.waitIdle();
    const count = host.db.prepare(`SELECT COUNT(*) AS n FROM run_snapshots`).get() as {
      n: number;
    };
    expect(count.n).toBe(1);
    host.stop();
    host.db.close();
  });

  it("starts a run when a fields virtual device flips a boolean state", async () => {
    const host = createTestHost({ seed: false });
    const created = await handleDevicesCreate(
      { db: host.db, runtimeId: "runtime_dev" },
      {
        requestId: "req_seat",
        name: "스마트 방석",
        fields: [
          { key: "state", type: "boolean", label: "착석" },
          { key: "pressure", type: "number", label: "압력" },
        ],
      },
    );
    const device = created.devices?.[0];
    expect(device?.id).toBeTruthy();
    upsertArtifact(host.db, {
      id: "seat-flow",
      definition: flow("seat-flow"),
      connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
      triggers: [
        {
          id: "device-trigger",
          kind: "device.changed",
          connectionId: "ha",
          config: { deviceId: device?.id ?? "", inputKey: "state" },
        },
      ],
    });
    const acted = await handleDevicesAction(
      {
        db: host.db,
        onEvent: (event) => dispatchDeviceTriggers(host, event, false),
      },
      {
        requestId: "req_sit",
        deviceId: device?.id ?? "",
        action: "set_fields",
        data: { state: true },
      },
    );
    expect(acted.device?.state).toBe("true");
    await host.waitIdle();
    const row = host.db.prepare(`SELECT input_json FROM trigger_inbox`).get() as {
      input_json: string;
    };
    const input = JSON.parse(row.input_json) as { state: boolean; on: boolean; pressure: number };
    expect(input.state).toBe(true);
    expect(input.on).toBe(true);
    expect(input.pressure).toBe(0);

    const before = host.db.prepare(`SELECT COUNT(*) AS n FROM trigger_inbox`).get() as { n: number };
    await handleDevicesAction(
      {
        db: host.db,
        onEvent: (event) => dispatchDeviceTriggers(host, event, false),
      },
      {
        requestId: "req_press",
        deviceId: device?.id ?? "",
        action: "set_fields",
        data: { pressure: 12 },
      },
    );
    await host.waitIdle();
    const after = host.db.prepare(`SELECT COUNT(*) AS n FROM trigger_inbox`).get() as { n: number };
    expect(after.n).toBe(before.n);
    host.stop();
    host.db.close();
  });
});
