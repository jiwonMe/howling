/**
 * 아직 반영하지 않은 inbox 메시지.
 */
import type Database from "better-sqlite3";

export const savePending = (
  db: Database.Database,
  id: string,
  payload: unknown,
): void => {
  db.prepare(
    `INSERT OR IGNORE INTO pending_inbox (id, payload_json, created_at)
     VALUES (?, ?, ?)`,
  ).run(id, JSON.stringify(payload), new Date().toISOString());
};

export const deletePending = (db: Database.Database, id: string): void => {
  db.prepare(`DELETE FROM pending_inbox WHERE id = ?`).run(id);
};

export const listPending = (db: Database.Database): { id: string; payload: unknown }[] => {
  const rows = db
    .prepare(`SELECT id, payload_json FROM pending_inbox ORDER BY created_at ASC`)
    .all() as { id: string; payload_json: string }[];
  return rows.map((row) => ({
    id: row.id,
    payload: JSON.parse(row.payload_json) as unknown,
  }));
};
