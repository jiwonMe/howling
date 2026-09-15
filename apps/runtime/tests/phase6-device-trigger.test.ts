import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@howling/core";
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
});
