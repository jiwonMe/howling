/**
 * Flow별 FIFO 입력 queue.
 */
import type { JsonValue } from "@howling/core";
import type Database from "better-sqlite3";

export const QUEUE_LIMIT = 100;
export const TRIGGER_TTL_MS = 5 * 60_000;

export type TriggerStatus = "queued" | "started" | "dropped" | "expired";
export type ProgressionMode = "manual" | "auto";

export interface TriggerRow {
  readonly id: string;
  readonly flowId: string;
  readonly artifactId: string;
  readonly input: JsonValue;
  readonly mode: ProgressionMode;
  readonly idempotencyKey: string;
  readonly status: TriggerStatus;
  readonly runId: string | null;
}

const TRIGGER_COLUMNS = `id, flow_id, artifact_id, input_json, mode, idempotency_key, status, run_id`;

export const findTriggerByKey = (
  db: Database.Database,
  flowId: string,
  key: string,
): TriggerRow | undefined =>
  mapTrigger(
    db
      .prepare(
        `SELECT ${TRIGGER_COLUMNS} FROM trigger_inbox
         WHERE flow_id = ? AND idempotency_key = ?`,
      )
      .get(flowId, key),
  );

export const getTrigger = (
  db: Database.Database,
  triggerId: string,
): TriggerRow | undefined =>
  mapTrigger(
    db.prepare(`SELECT ${TRIGGER_COLUMNS} FROM trigger_inbox WHERE id = ?`).get(
      triggerId,
    ),
  );

export const queuedCount = (db: Database.Database, flowId: string): number => {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM trigger_inbox WHERE flow_id = ? AND status = 'queued'`,
    )
    .get(flowId) as { n: number };
  return row.n;
};

export const insertTrigger = (
  db: Database.Database,
  row: Omit<TriggerRow, "status" | "runId"> & { readonly expiresAt: string },
): void => {
  db.prepare(
    `INSERT INTO trigger_inbox
       (id, flow_id, artifact_id, input_json, mode, idempotency_key, expires_at, status, run_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', NULL, ?)`,
  ).run(
    row.id,
    row.flowId,
    row.artifactId,
    JSON.stringify(row.input),
    row.mode,
    row.idempotencyKey,
    row.expiresAt,
    new Date().toISOString(),
  );
};

export const markTriggerStarted = (
  db: Database.Database,
  triggerId: string,
  runId: string,
): void => {
  db.prepare(
    `UPDATE trigger_inbox SET status = 'started', run_id = ? WHERE id = ?`,
  ).run(runId, triggerId);
};

export const markTriggerDropped = (db: Database.Database, triggerId: string): void => {
  db.prepare(`UPDATE trigger_inbox SET status = 'dropped' WHERE id = ?`).run(
    triggerId,
  );
};

export const nextQueuedTrigger = (
  db: Database.Database,
  flowId: string,
  nowIso: string,
): TriggerRow | undefined => {
  db.prepare(
    `UPDATE trigger_inbox
     SET status = 'expired'
     WHERE flow_id = ? AND status = 'queued' AND expires_at IS NOT NULL AND expires_at < ?`,
  ).run(flowId, nowIso);
  return mapTrigger(
    db
      .prepare(
        `SELECT id, flow_id, artifact_id, input_json, mode, idempotency_key, status, run_id
         FROM trigger_inbox
         WHERE flow_id = ? AND status = 'queued'
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .get(flowId),
  );
};

export const getTriggerByRun = (
  db: Database.Database,
  runId: string,
): TriggerRow | undefined =>
  mapTrigger(
    db
      .prepare(`SELECT ${TRIGGER_COLUMNS} FROM trigger_inbox WHERE run_id = ?`)
      .get(runId),
  );

const mapTrigger = (row: unknown): TriggerRow | undefined => {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  const value = row as {
    id: string;
    flow_id: string;
    artifact_id: string;
    input_json: string;
    mode: ProgressionMode;
    idempotency_key: string;
    status: TriggerStatus;
    run_id: string | null;
  };
  return {
    id: value.id,
    flowId: value.flow_id,
    artifactId: value.artifact_id,
    input: JSON.parse(value.input_json) as JsonValue,
    mode: value.mode,
    idempotencyKey: value.idempotency_key,
    status: value.status,
    runId: value.run_id,
  };
};
