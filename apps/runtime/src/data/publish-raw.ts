/**
 * captureRaw ON 이후 이벤트만 raw stream에 올린다. 소급하지 않는다.
 */
import type { GatewayHandle } from "../gateway/client.js";
import { getArtifact, getDeployment } from "../store/artifacts.js";
import { listEvents } from "../store/events.js";
import { getRun } from "../store/runs.js";
import { appendJournal, listUnacked, tombstoneUnacked } from "../store/sync-journal.js";
import { getLocalPolicy } from "./policy.js";
import { projectFields } from "./project.js";
import type Database from "better-sqlite3";

export const applyCaptureGate = (db: Database.Database): number => {
  const local = getLocalPolicy(db);
  if (local.captureRaw) {
    return 0;
  }
  return tombstoneUnacked(db, "raw");
};

export const publishRunRaw = (
  db: Database.Database,
  gateway: GatewayHandle,
  runId: string,
): void => {
  const local = getLocalPolicy(db);
  if (!local.captureRaw) {
    return;
  }
  const run = getRun(db, runId);
  if (!run || !allowsFlow(db, run.flowId)) {
    return;
  }
  const fields = projectRun(db, runId, run.flowId);
  const batch = {
    runtimeId: gateway.runtimeId() ?? "runtime_dev",
    stream: "raw" as const,
    runId,
    flowId: run.flowId,
    revisionId: run.artifactId,
    capturedAt: new Date().toISOString(),
    items: fields,
    tombstone: false,
  };
  try {
    const syncSeq = appendJournal(db, "raw", runId, batch);
    gateway.send("raw.batch", { ...batch, syncSeq });
  } catch {
    // raw 실패가 summary·실행을 막으면 안 된다.
  }
};

export const flushUnackedRaw = (db: Database.Database, gateway: GatewayHandle): void => {
  applyCaptureGate(db);
  for (const row of listUnacked(db, "raw")) {
    const item = asRecord(row.item);
    gateway.send("raw.batch", {
      runtimeId: gateway.runtimeId() ?? "runtime_dev",
      stream: "raw",
      syncSeq: row.syncSeq,
      runId: row.runId,
      flowId: String(item.flowId ?? "tombstone"),
      revisionId: String(item.revisionId ?? "tombstone"),
      capturedAt: String(item.capturedAt ?? new Date().toISOString()),
      items: Array.isArray(item.items) ? item.items : [],
      tombstone: row.tombstone || item.tombstone === true,
    });
  }
};

const allowsFlow = (db: Database.Database, flowId: string): boolean => {
  const deployment = getDeployment(db, flowId);
  if (!deployment) {
    return false;
  }
  const artifact = getArtifact(db, deployment.artifactId);
  return artifact?.executionPolicy.captureRaw === true;
};

const projectRun = (db: Database.Database, runId: string, flowId: string) => {
  const fields = getLocalPolicy(db).observations.fields;
  return listEvents(db, runId).map((event) => ({
    sequence: event.sequence,
    type: event.type,
    ...("nodeId" in event ? { nodeId: event.nodeId } : {}),
    fields: projectFields(event, fields, flowId),
  }));
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

