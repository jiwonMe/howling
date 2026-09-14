/**
 * Run summary 저장.
 */
import type pg from "pg";

export type RunSummaryRow = {
  readonly runId: string;
  readonly flowId: string;
  readonly revisionId: string;
  readonly status: string;
  readonly lastSeq: number;
  readonly trigger: unknown;
  readonly events: unknown;
  readonly runMode?: string;
};

export const upsertRunSummary = async (
  pool: pg.Pool,
  siteId: string,
  summary: RunSummaryRow,
): Promise<void> => {
  await pool.query(
    `INSERT INTO run_summaries
       (run_id, site_id, flow_id, revision_id, status, last_seq, trigger_json, events_json, updated_at, run_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now(), COALESCE($9, 'live'))
     ON CONFLICT (run_id) DO UPDATE SET
       status = EXCLUDED.status,
       last_seq = EXCLUDED.last_seq,
       events_json = EXCLUDED.events_json,
       trigger_json = EXCLUDED.trigger_json,
       run_mode = COALESCE($9, run_summaries.run_mode),
       updated_at = now()
     WHERE run_summaries.last_seq <= EXCLUDED.last_seq`,
    [
      summary.runId,
      siteId,
      summary.flowId,
      summary.revisionId,
      summary.status,
      summary.lastSeq,
      JSON.stringify(summary.trigger),
      JSON.stringify(summary.events),
      summary.runMode ?? null,
    ],
  );
};

export const insertAcceptedRun = async (
  pool: pg.Pool,
  input: {
    readonly siteId: string;
    readonly runId: string;
    readonly flowId: string;
    readonly revisionId: string;
    readonly trigger: unknown;
    readonly runMode: string;
  },
): Promise<void> => {
  await upsertRunSummary(pool, input.siteId, {
    runId: input.runId,
    flowId: input.flowId,
    revisionId: input.revisionId,
    status: "accepted",
    lastSeq: 0,
    trigger: input.trigger,
    events: [],
    runMode: input.runMode,
  });
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

export const getTestSession = async (pool: pg.Pool, runId: string) => {
  const result = await pool.query(
    `SELECT * FROM test_sessions WHERE run_id = $1`,
    [runId],
  );
  return result.rows[0] as
    | {
        artifact_json: unknown;
        fixtures_json: unknown;
        source: string;
      }
    | undefined;
};
