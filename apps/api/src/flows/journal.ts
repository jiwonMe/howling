/**
 * Summary SyncJournal. 연속 syncSeq만 ACK한다.
 */
import type { SummaryBatch } from "./journal-types.js";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { upsertRunSummary } from "./runs.js";

export const appendSummaryBatch = async (
  pool: pg.Pool,
  siteId: string,
  runtimeId: string,
  batch: SummaryBatch,
): Promise<void> => {
  const inserted = await pool.query(
    `INSERT INTO sync_journal
       (runtime_id, stream, sync_seq, run_id, item_json, tombstone, created_at)
     VALUES ($1, 'summary', $2, $3, $4::jsonb, false, now())
     ON CONFLICT (runtime_id, stream, sync_seq) DO NOTHING`,
    [runtimeId, batch.syncSeq, batch.runId, JSON.stringify(batch)],
  );
  if ((inserted.rowCount ?? 0) === 0) {
    return;
  }
  await upsertRunSummary(pool, siteId, {
    runId: batch.runId,
    flowId: batch.flowId,
    revisionId: batch.revisionId,
    status: batch.status,
    lastSeq: batch.lastSeq,
    trigger: batch.trigger,
    events: batch.items.map((item) => ({
      sequence: item.sequence,
      type: item.type,
      ...(item.nodeId ? { nodeId: item.nodeId } : {}),
    })),
    ...(batch.runMode ? { runMode: batch.runMode } : {}),
  });
  await ackConsecutive(pool, siteId, runtimeId);
};

export const listJournalAfter = async (
  pool: pg.Pool,
  runtimeId: string,
  after: number,
) => {
  const cursor = await pool.query<{ min_seq: string }>(
    `SELECT min_seq FROM sync_cursors WHERE runtime_id = $1 AND stream = 'summary'`,
    [runtimeId],
  );
  const minSeq = Number(cursor.rows[0]?.min_seq ?? 1);
  if (after > 0 && after < minSeq - 1) {
    return { resync: true as const, minSeq, rows: [] };
  }
  const result = await pool.query<{
    sync_seq: string;
    run_id: string;
    item_json: SummaryBatch;
    tombstone: boolean;
  }>(
    `SELECT sync_seq, run_id, item_json, tombstone
     FROM sync_journal
     WHERE runtime_id = $1 AND stream = 'summary' AND sync_seq > $2
     ORDER BY sync_seq`,
    [runtimeId, after],
  );
  return {
    resync: false as const,
    minSeq,
    rows: result.rows.map((row) => ({
      syncSeq: Number(row.sync_seq),
      runId: row.run_id,
      item: row.item_json,
      tombstone: row.tombstone,
    })),
  };
};

export const listJournalForRun = async (
  pool: pg.Pool,
  runId: string,
  after: number,
) => {
  const result = await pool.query<{
    sync_seq: string;
    item_json: SummaryBatch;
    runtime_id: string;
  }>(
    `SELECT sync_seq, item_json, runtime_id
     FROM sync_journal
     WHERE stream = 'summary' AND run_id = $1 AND sync_seq > $2
     ORDER BY sync_seq`,
    [runId, after],
  );
  return result.rows.map((row) => ({
    syncSeq: Number(row.sync_seq),
    runtimeId: row.runtime_id,
    item: row.item_json,
  }));
};

const ackConsecutive = async (
  pool: pg.Pool,
  siteId: string,
  runtimeId: string,
): Promise<void> => {
  await pool.query(
    `INSERT INTO sync_cursors (runtime_id, stream, last_acked, min_seq)
     VALUES ($1, 'summary', 0, 1)
     ON CONFLICT (runtime_id, stream) DO NOTHING`,
    [runtimeId],
  );
  const cursor = await pool.query<{ last_acked: string }>(
    `SELECT last_acked FROM sync_cursors WHERE runtime_id = $1 AND stream = 'summary'`,
    [runtimeId],
  );
  let last = Number(cursor.rows[0]?.last_acked ?? 0);
  const pending = await pool.query<{ sync_seq: string }>(
    `SELECT sync_seq FROM sync_journal
     WHERE runtime_id = $1 AND stream = 'summary' AND sync_seq > $2
     ORDER BY sync_seq`,
    [runtimeId, last],
  );
  for (const row of pending.rows) {
    const seq = Number(row.sync_seq);
    if (seq !== last + 1) {
      break;
    }
    last = seq;
  }
  if (last === Number(cursor.rows[0]?.last_acked ?? 0)) {
    return;
  }
  await pool.query(
    `UPDATE sync_journal SET acked_at = now()
     WHERE runtime_id = $1 AND stream = 'summary' AND sync_seq <= $2 AND acked_at IS NULL`,
    [runtimeId, last],
  );
  await pool.query(
    `UPDATE sync_cursors SET last_acked = $2 WHERE runtime_id = $1 AND stream = 'summary'`,
    [runtimeId, last],
  );
  sendToRuntime(siteId, "summary.ack", {
    runtimeId,
    stream: "summary",
    syncSeq: last,
  });
};
