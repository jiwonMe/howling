/**
 * 원본 execution event와 command 중복 기록.
 */
import type { ExecutionEvent } from "@howling/core";
import type Database from "better-sqlite3";
import { sha256Json } from "./hash.js";

export const insertEvents = (
  db: Database.Database,
  events: readonly ExecutionEvent[],
): void => {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO run_events (run_id, sequence, event_json) VALUES (?, ?, ?)`,
  );
  for (const event of events) {
    stmt.run(event.runId, event.sequence, JSON.stringify(event));
  }
};

export const listEvents = (
  db: Database.Database,
  runId: string,
): ExecutionEvent[] => {
  const rows = db
    .prepare(
      `SELECT event_json FROM run_events WHERE run_id = ? ORDER BY sequence ASC`,
    )
    .all(runId) as { event_json: string }[];
  return rows.map((row) => JSON.parse(row.event_json) as ExecutionEvent);
};

export const recordCommand = (
  db: Database.Database,
  input: {
    readonly commandId: string;
    readonly runId: string;
    readonly digest: string;
    readonly payload: unknown;
  },
): void => {
  db.prepare(
    `INSERT OR IGNORE INTO runtime_commands
       (command_id, run_id, digest, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    input.commandId,
    input.runId,
    input.digest,
    JSON.stringify(input.payload),
    new Date().toISOString(),
  );
};

export const decideCommand = (
  db: Database.Database,
  commandId: string,
  payload: unknown,
): { readonly decision: "fresh" | "duplicate" | "conflict"; readonly digest: string } => {
  const digest = sha256Json(payload);
  const existing = getCommand(db, commandId);
  if (!existing) {
    return { decision: "fresh", digest };
  }
  if (existing.digest === digest) {
    return { decision: "duplicate", digest };
  }
  return { decision: "conflict", digest };
};

export const getCommand = (
  db: Database.Database,
  commandId: string,
): { digest: string; payload: unknown } | undefined => {
  const row = db
    .prepare(
      `SELECT digest, payload_json FROM runtime_commands WHERE command_id = ?`,
    )
    .get(commandId) as { digest: string; payload_json: string } | undefined;
  if (!row) {
    return undefined;
  }
  return { digest: row.digest, payload: JSON.parse(row.payload_json) };
};
