/**
 * stream별 ACK. raw 실패가 summary를 막지 않게 호출측에서 분리한다.
 */
import type { SyncStream } from "@howling/contracts";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";

export const appendStreamRow = async (
  pool: pg.Pool,
  input: {
    readonly siteId: string;
    readonly runtimeId: string;
    readonly stream: SyncStream;
    readonly syncSeq: number;
    readonly runId: string | null;
    readonly item: unknown;
    readonly tombstone?: boolean;
  },
): Promise<boolean> => {
  const inserted = await pool.query(
    `INSERT INTO sync_journal
       (runtime_id, stream, sync_seq, run_id, item_json, tombstone, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())
     ON CONFLICT (runtime_id, stream, sync_seq) DO NOTHING`,
    [
      input.runtimeId,
      input.stream,
      input.syncSeq,
      input.runId,
      JSON.stringify(input.item),
      input.tombstone ?? false,
    ],
  );
  if ((inserted.rowCount ?? 0) === 0) {
    return false;
  }
  await ackStream(pool, input.siteId, input.runtimeId, input.stream);
  return true;
};

export const ackStream = async (
  pool: pg.Pool,
  siteId: string,
  runtimeId: string,
  stream: SyncStream,
): Promise<void> => {
  await pool.query(
    `INSERT INTO sync_cursors (runtime_id, stream, last_acked, min_seq)
     VALUES ($1, $2, 0, 1)
     ON CONFLICT (runtime_id, stream) DO NOTHING`,
    [runtimeId, stream],
  );
  const cursor = await pool.query<{ last_acked: string }>(
    `SELECT last_acked FROM sync_cursors WHERE runtime_id = $1 AND stream = $2`,
    [runtimeId, stream],
  );
  let last = Number(cursor.rows[0]?.last_acked ?? 0);
  const pending = await pool.query<{ sync_seq: string }>(
    `SELECT sync_seq FROM sync_journal
     WHERE runtime_id = $1 AND stream = $2 AND sync_seq > $3
     ORDER BY sync_seq`,
    [runtimeId, stream, last],
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
     WHERE runtime_id = $1 AND stream = $2 AND sync_seq <= $3 AND acked_at IS NULL`,
    [runtimeId, stream, last],
  );
  await pool.query(
    `UPDATE sync_cursors SET last_acked = $3 WHERE runtime_id = $1 AND stream = $2`,
    [runtimeId, stream, last],
  );
  sendToRuntime(siteId, `${stream}.ack`, { runtimeId, stream, syncSeq: last });
};
