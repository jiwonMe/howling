/**
 * Run summary 저장.
 */
import type { RunSummary } from "@howling/contracts";
import type pg from "pg";

export const upsertRunSummary = async (
  pool: pg.Pool,
  siteId: string,
  summary: RunSummary,
): Promise<void> => {
  await pool.query(
    `INSERT INTO run_summaries
       (run_id, site_id, flow_id, revision_id, status, last_seq, trigger_json, events_json, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now())
     ON CONFLICT (run_id) DO UPDATE SET
       status = EXCLUDED.status,
       last_seq = EXCLUDED.last_seq,
       events_json = EXCLUDED.events_json,
       updated_at = now()`,
    [
      summary.runId,
      siteId,
      summary.flowId,
      summary.revisionId,
      summary.status,
      summary.lastSeq,
      JSON.stringify(summary.trigger),
      JSON.stringify(summary.events),
    ],
  );
};

export const listRuns = async (pool: pg.Pool, siteId: string, flowId?: string) => {
  const result = flowId
    ? await pool.query(
        `SELECT * FROM run_summaries WHERE site_id = $1 AND flow_id = $2 ORDER BY updated_at DESC`,
        [siteId, flowId],
      )
    : await pool.query(
        `SELECT * FROM run_summaries WHERE site_id = $1 ORDER BY updated_at DESC`,
        [siteId],
      );
  return result.rows;
};

export const getRun = async (pool: pg.Pool, siteId: string, runId: string) => {
  const result = await pool.query(
    `SELECT * FROM run_summaries WHERE site_id = $1 AND run_id = $2`,
    [siteId, runId],
  );
  return result.rows[0];
};
