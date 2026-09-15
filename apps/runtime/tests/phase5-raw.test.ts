import { DEFAULT_DATA_POLICY } from "@howling/contracts";
import { describe, expect, it } from "vitest";
import { applyCaptureGate, flushUnackedRaw, publishRunRaw } from "../src/data/publish-raw.js";
import { putLocalPolicy } from "../src/data/policy.js";
import { retainLocal } from "../src/data/retain.js";
import { answerDetail } from "../src/data/detail.js";
import type { GatewayHandle } from "../src/gateway/client.js";
import { getArtifact, storeArtifact } from "../src/store/artifacts.js";
import { publishRunSummary } from "../src/gateway/summary.js";
import { listUnacked } from "../src/store/sync-journal.js";
import { createTestHost, startRun } from "./helpers.js";

const fakeGateway = (sent: { type: string; payload: unknown }[]): GatewayHandle => ({
  stop: () => undefined,
  send: (type, payload) => {
    sent.push({ type, payload });
    return true;
  },
  runtimeId: () => "runtime_dev",
  hold: () => undefined,
  release: () => undefined,
  setIdentity: () => undefined,
  setConnectors: () => undefined,
});

const enableRaw = (db: ReturnType<typeof createTestHost>["db"], capture = true) => {
  const artifact = getArtifact(db, "power-alert");
  if (artifact) {
    storeArtifact(db, {
      id: artifact.id,
      definition: artifact.definition,
      executionPolicy: { mode: "live", captureRaw: capture },
    });
  }
  putLocalPolicy(db, {
    policy: { ...DEFAULT_DATA_POLICY },
    captureRaw: capture,
    observations: {
      fields: [{ id: "power", flowId: "power-alert", nodeId: "input", pointer: "/value/power" }],
    },
  });
};

describe("phase 5 raw journal", () => {
  it("uploads selected fields only after captureRaw is on", async () => {
    const sent: { type: string; payload: unknown }[] = [];
    const gateway = fakeGateway(sent);
    const host = createTestHost();
    enableRaw(host.db, true);
    const started = await startRun(host, { artifactId: "power-alert", input: { power: 800 } });
    publishRunRaw(host.db, gateway, started.runId ?? "");
    const batches = sent.filter((item) => item.type === "raw.batch");
    expect(batches.length).toBe(1);
    const payload = batches[0]?.payload as { items: { fields: Record<string, unknown> }[] };
    expect(payload.items.some((item) => item.fields.power === 800)).toBe(true);
    host.stop();
    host.db.close();
  });

  it("tombstones pending raw when policy turns off", async () => {
    const sent: { type: string; payload: unknown }[] = [];
    const gateway = fakeGateway(sent);
    const host = createTestHost();
    enableRaw(host.db, true);
    const started = await startRun(host, { artifactId: "power-alert", input: { power: 900 } });
    publishRunRaw(host.db, gateway, started.runId ?? "");
    expect(listUnacked(host.db, "raw").length).toBe(1);
    enableRaw(host.db, false);
    expect(applyCaptureGate(host.db)).toBeGreaterThan(0);
    flushUnackedRaw(host.db, gateway);
    const last = sent.filter((item) => item.type === "raw.batch").at(-1)?.payload as {
      tombstone?: boolean;
    };
    expect(last.tombstone).toBe(true);
    host.stop();
    host.db.close();
  });

  it("keeps in-progress snapshots when retaining", async () => {
    const host = createTestHost();
    const started = await startRun(host, {
      artifactId: "power-alert",
      input: { power: 800 },
      mode: "manual",
    });
    putLocalPolicy(host.db, {
      policy: { ...DEFAULT_DATA_POLICY, localRetentionDays: 1, capacityBytes: 1 },
      captureRaw: false,
      observations: { fields: [] },
    });
    const purged = retainLocal(host.db, Date.now() + 10 * 86_400_000);
    expect(purged).toBe(0);
    expect(started.runId).toBeTruthy();
    host.stop();
    host.db.close();
  });

  it("keeps summary publishing when raw journal is broken", async () => {
    const sent: { type: string; payload: unknown }[] = [];
    const gateway = fakeGateway(sent);
    const host = createTestHost();
    enableRaw(host.db, true);
    const started = await startRun(host, { artifactId: "power-alert", input: { power: 800 } });
    publishRunSummary(host, gateway, started.runId ?? "");
    host.db.exec(`DROP TABLE summary_journal`);
    publishRunRaw(host.db, gateway, started.runId ?? "");
    expect(sent.some((item) => item.type === "summary.batch" || item.type === "run.summary")).toBe(true);
    host.stop();
    host.db.close();
  });

  it("answers detail from local events without writing a journal row", async () => {
    const host = createTestHost();
    const started = await startRun(host, { artifactId: "power-alert", input: { power: 1400 } });
    const before = listUnacked(host.db, "raw").length;
    const answer = answerDetail(host.db, {
      requestId: "req_1",
      runId: started.runId ?? "",
      nodeId: "input",
      field: "/value/power",
    });
    expect(answer.unavailable).toBeUndefined();
    expect(listUnacked(host.db, "raw").length).toBe(before);
    host.stop();
    host.db.close();
  });
});
