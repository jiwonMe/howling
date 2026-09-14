import { describe, expect, it } from "vitest";
import { createHaAwareAdapter } from "../src/ha/adapter.js";
import type { HaHandle } from "../src/ha/client.js";
import { dispatchHaTriggers } from "../src/ha/triggers.js";
import {
  matchHaNumericTrigger,
  parseHaNumber,
} from "../src/ha/match.js";
import { pendingId, readWsText } from "../src/ha/ws-parse.js";
import { createFakeAdapter } from "../src/effects/fake-adapter.js";
import { upsertArtifact } from "../src/store/artifacts.js";
import { createTestHost, eventsOf, startRun } from "./helpers.js";
import type { WorkflowDefinition } from "@howling/core";

const haFlow = (id: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id,
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "notify",
      type: "core.effect",
      version: 1,
      config: { adapter: "homeassistant", operation: "call_service" },
      inputs: {
        request: {
          kind: "literal",
          value: {
            domain: "input_boolean",
            service: "turn_on",
            service_data: { entity_id: "input_boolean.test_alert" },
          },
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: { nodeId: "input", port: "success" },
      target: { nodeId: "notify", port: "in" },
    },
  ],
});

describe("HA mapping and adapter", () => {
  it("reads fragmented websocket text and string ids", () => {
    expect(readWsText(Buffer.from('{"id":4}'))).toBe('{"id":4}');
    expect(readWsText([Buffer.from('{"id":'), Buffer.from("4}")])).toBe('{"id":4}');
    expect(pendingId("4")).toBe(4);
    expect(pendingId(4)).toBe(4);
    expect(pendingId("x")).toBeUndefined();
  });

  it("does not map empty or unknown states to zero", () => {
    expect(parseHaNumber("")).toBeUndefined();
    expect(parseHaNumber("unknown")).toBeUndefined();
    expect(parseHaNumber("unavailable")).toBeUndefined();
    expect(parseHaNumber("800")).toBe(800);
    expect(
      matchHaNumericTrigger({
        entityId: "input_number.test_power",
        wanted: "input_number.test_power",
        previous: "unknown",
        next: "800",
        syncing: false,
        inputKey: "power",
      }),
    ).toBeUndefined();
  });

  it("does not start a run from a snapshot event", async () => {
    const host = createTestHost({ seed: false });
    upsertArtifact(host.db, {
      id: "ha-mean",
      definition: haFlow("ha-mean"),
      triggers: [
        {
          id: "t1",
          kind: "ha.state_changed",
          connectionId: "ha",
          config: { entityId: "input_number.test_power", inputKey: "power" },
        },
      ],
    });
    dispatchHaTriggers(
      host,
      { entityId: "input_number.test_power", state: "800" },
      true,
    );
    await host.waitIdle();
    const count = host.db.prepare(`SELECT COUNT(*) AS n FROM run_snapshots`).get() as {
      n: number;
    };
    expect(count.n).toBe(0);
    host.stop();
    host.db.close();
  });

  it("calls HA only after dispatchStarted is committed", async () => {
    let sawDispatch = false;
    const box: { db?: { prepare: (sql: string) => { all: () => { event_json: string }[] } } } = {};
    const ha: HaHandle = {
      status: () => "ready",
      lastSyncAt: () => null,
      callService: async () => {
        const events = box.db?.prepare(`SELECT event_json FROM run_events`).all() ?? [];
        sawDispatch = events.some((row) =>
          (JSON.parse(row.event_json) as { type: string }).type === "effect.dispatchStarted",
        );
        return { ok: true };
      },
      stop: () => undefined,
    };
    const host = createTestHost({
      seed: false,
      adapter: createHaAwareAdapter({
        fake: createFakeAdapter(),
        ha: () => ha,
        testHooks: true,
      }),
    });
    box.db = host.db;
    upsertArtifact(host.db, { id: "ha-effect", definition: haFlow("ha-effect") });
    const started = await startRun(host, {
      artifactId: "ha-effect",
      input: { power: 1 },
      mode: "auto",
    });
    expect(started.status).toBe("started");
    expect(sawDispatch).toBe(true);
    expect(host.adapter.calls).toHaveLength(1);
    expect(
      eventsOf(host, started.runId ?? "").some((event) => event.type === "effect.dispatchStarted"),
    ).toBe(true);
    host.stop();
    host.db.close();
  });
});
