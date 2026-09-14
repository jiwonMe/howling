/**
 * Summary stream cursor. raw는 이 단계에서 올리지 않는다.
 */
import type Database from "better-sqlite3";

export interface SummaryJournalRow {
  readonly stream: "summary";
  readonly syncSeq: number;
  readonly runId: string;
  readonly item: unknown;
  readonly acked: boolean;
}

export const appendSummaryJournal = (
  db: Database.Database,
  runId: string,
  item: unknown,
): number => {
  const last = db
    .prepare(`SELECT MAX(sync_seq) AS n FROM summary_journal WHERE stream = 'summary'`)
    .get() as { n: number | null };
  const syncSeq = (last.n ?? 0) + 1;
  db.prepare(
    `INSERT INTO summary_journal (stream, sync_seq, run_id, item_json, acked, created_at)
     VALUES ('summary', ?, ?, ?, 0, ?)`,
  ).run(syncSeq, runId, JSON.stringify(item), new Date().toISOString());
  return syncSeq;
};

export const listUnackedSummary = (db: Database.Database): SummaryJournalRow[] => {
  const rows = db
    .prepare(
      `SELECT stream, sync_seq, run_id, item_json, acked
       FROM summary_journal WHERE stream = 'summary' AND acked = 0
       ORDER BY sync_seq`,
    )
    .all() as {
    stream: "summary";
    sync_seq: number;
    run_id: string;
    item_json: string;
    acked: number;
  }[];
  return rows.map((row) => ({
    stream: "summary",
    syncSeq: row.sync_seq,
    runId: row.run_id,
    item: JSON.parse(row.item_json) as unknown,
    acked: row.acked === 1,
  }));
};

export const ackSummary = (db: Database.Database, syncSeq: number): void => {
  db.prepare(
    `UPDATE summary_journal SET acked = 1 WHERE stream = 'summary' AND sync_seq <= ?`,
  ).run(syncSeq);
};
