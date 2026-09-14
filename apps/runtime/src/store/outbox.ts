/**
 * Effect outbox. effectId로 중복을 제거한다.
 */
import type { EffectIntent, EffectResponse } from "@howling/core";
import type { EffectRecordStatus } from "./core-types.js";
import type Database from "better-sqlite3";

export interface OutboxRow {
  readonly effectId: string;
  readonly runId: string;
  readonly nodeId: string;
  readonly intent: EffectIntent;
  readonly status: EffectRecordStatus;
  readonly response: EffectResponse | null;
}

export const upsertOutbox = (
  db: Database.Database,
  row: OutboxRow,
): void => {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO effect_outbox
       (effect_id, run_id, node_id, intent_json, status, response_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (effect_id) DO UPDATE SET
       status = excluded.status,
       response_json = excluded.response_json,
       updated_at = excluded.updated_at`,
  ).run(
    row.effectId,
    row.runId,
    row.nodeId,
    JSON.stringify(row.intent),
    row.status,
    row.response ? JSON.stringify(row.response) : null,
    now,
    now,
  );
};

export const listOutbox = (
  db: Database.Database,
  runId: string,
): OutboxRow[] => {
  const rows = db
    .prepare(`SELECT * FROM effect_outbox WHERE run_id = ?`)
    .all(runId) as Record<string, unknown>[];
  return rows.map(mapOutbox);
};

export const getOutbox = (
  db: Database.Database,
  effectId: string,
): OutboxRow | undefined => {
  const row = db
    .prepare(`SELECT * FROM effect_outbox WHERE effect_id = ?`)
    .get(effectId);
  return row ? mapOutbox(row as Record<string, unknown>) : undefined;
};

export const listOutboxByStatus = (
  db: Database.Database,
  runId: string,
  status: EffectRecordStatus,
): OutboxRow[] => {
  const rows = db
    .prepare(`SELECT * FROM effect_outbox WHERE run_id = ? AND status = ?`)
    .all(runId, status) as Record<string, unknown>[];
  return rows.map(mapOutbox);
};

export const listAllOutboxByStatus = (
  db: Database.Database,
  status: EffectRecordStatus,
): OutboxRow[] => {
  const rows = db
    .prepare(`SELECT * FROM effect_outbox WHERE status = ?`)
    .all(status) as Record<string, unknown>[];
  return rows.map(mapOutbox);
};

const mapOutbox = (row: Record<string, unknown>): OutboxRow => ({
  effectId: String(row.effect_id),
  runId: String(row.run_id),
  nodeId: String(row.node_id),
  intent: JSON.parse(String(row.intent_json)) as EffectIntent,
  status: row.status as EffectRecordStatus,
  response: row.response_json
    ? (JSON.parse(String(row.response_json)) as EffectResponse)
    : null,
});
