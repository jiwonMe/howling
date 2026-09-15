/**
 * 클라우드 원본·관측 보관. OFF는 이 함수를 호출하지 않는다.
 */
import type pg from "pg";
import { getDataPolicy } from "./store.js";

export const retainCloud = async (
  pool: pg.Pool,
  siteId: string,
  force = false,
): Promise<number> => {
  const policy = await getDataPolicy(pool, siteId);
  const rawCutoff = new Date(Date.now() - policy.cloudRawDays * 86_400_000);
  const summaryCutoff = new Date(Date.now() - policy.cloudSummaryDays * 86_400_000);
  const samples = await pool.query(
    `DELETE FROM observe_samples WHERE site_id = $1 AND ts < $2`,
    [siteId, force ? new Date() : rawCutoff],
  );
  const runtime = await pool.query<{ runtime_id: string }>(
    `SELECT runtime_id FROM runtime_registrations WHERE site_id = $1`,
    [siteId],
  );
  let journal = 0;
  for (const row of runtime.rows) {
    journal += await tombstoneOld(pool, row.runtime_id, "raw", force ? new Date() : rawCutoff);
    journal += await tombstoneOld(pool, row.runtime_id, "summary", summaryCutoff);
    journal += await tombstoneOld(pool, row.runtime_id, "observe", force ? new Date() : rawCutoff);
  }
  return (samples.rowCount ?? 0) + journal;
};

const tombstoneOld = async (
  pool: pg.Pool,
  runtimeId: string,
  stream: string,
  cutoff: Date,
): Promise<number> => {
  const result = await pool.query(
    `UPDATE sync_journal
     SET item_json = '{}'::jsonb, tombstone = true
     WHERE runtime_id = $1 AND stream = $2 AND created_at < $3 AND tombstone = false`,
    [runtimeId, stream, cutoff],
  );
  const min = await pool.query<{ sync_seq: string }>(
    `SELECT MIN(sync_seq) AS sync_seq FROM sync_journal
     WHERE runtime_id = $1 AND stream = $2 AND tombstone = false`,
    [runtimeId, stream],
  );
  if (min.rows[0]?.sync_seq) {
    await pool.query(
      `UPDATE sync_cursors SET min_seq = $3 WHERE runtime_id = $1 AND stream = $2`,
      [runtimeId, stream, Number(min.rows[0].sync_seq)],
    );
  }
  return result.rowCount ?? 0;
};
