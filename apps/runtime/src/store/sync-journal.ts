/**
 * stream별 syncSeq. summary·raw·observe를 같은 테이블에 둔다.
 */
import type { SyncStream } from "@howling/contracts";
import type Database from "better-sqlite3";

export interface JournalRow {
  readonly stream: SyncStream;
  readonly syncSeq: number;
  readonly runId: string;
  readonly item: unknown;
  readonly acked: boolean;
  readonly tombstone: boolean;
}

export const appendJournal = (
  db: Database.Database,
  stream: SyncStream,
  runId: string,
  item: unknown,
  tombstone = false,
): number => {
  const last = db
    .prepare(`SELECT MAX(sync_seq) AS n FROM summary_journal WHERE stream = ?`)
    .get(stream) as { n: number | null };
  const syncSeq = (last.n ?? 0) + 1;
  db.prepare(
    `INSERT INTO summary_journal
       (stream, sync_seq, run_id, item_json, acked, created_at, tombstone)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(stream, syncSeq, runId, JSON.stringify(item), new Date().toISOString(), tombstone ? 1 : 0);
  return syncSeq;
};

export const listUnacked = (db: Database.Database, stream: SyncStream): JournalRow[] => {
  const rows = db
    .prepare(
      `SELECT stream, sync_seq, run_id, item_json, acked, tombstone
       FROM summary_journal WHERE stream = ? AND acked = 0
       ORDER BY sync_seq`,
    )
    .all(stream) as {
    stream: SyncStream;
    sync_seq: number;
    run_id: string;
    item_json: string;
    acked: number;
    tombstone: number;
  }[];
  return rows.map((row) => ({
    stream: row.stream,
    syncSeq: row.sync_seq,
    runId: row.run_id,
    item: JSON.parse(row.item_json) as unknown,
    acked: row.acked === 1,
    tombstone: row.tombstone === 1,
  }));
};

export const ackJournal = (db: Database.Database, stream: SyncStream, syncSeq: number): void => {
  db.prepare(
    `UPDATE summary_journal SET acked = 1 WHERE stream = ? AND sync_seq <= ?`,
  ).run(stream, syncSeq);
};

export const tombstoneUnacked = (db: Database.Database, stream: SyncStream): number => {
  const result = db
    .prepare(
      `UPDATE summary_journal
       SET item_json = '{}', tombstone = 1
       WHERE stream = ? AND acked = 0 AND tombstone = 0`,
    )
    .run(stream);
  return result.changes;
};
