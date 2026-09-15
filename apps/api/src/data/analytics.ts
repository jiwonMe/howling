/**
 * 공식 집계. 원문 payload는 읽지 않는다.
 */
import { errorBody, errorCodes, type AnalyticsSnapshot } from "@howling/contracts";
import type pg from "pg";
import { runtimeIdBySite } from "../runtime/hub.js";
import { denied, type Actor, type ServiceResult } from "../flows/access.js";

export const getAnalyticsFor = async (
  pool: pg.Pool,
  actor: Actor,
  after = 0,
): Promise<ServiceResult> => {
  const scope = denied(actor, "read");
  if (scope) {
    return scope;
  }
  const runtimeId = runtimeIdBySite(actor.siteId);
  if (runtimeId && after > 0) {
    const cursor = await pool.query<{ min_seq: string }>(
      `SELECT min_seq FROM sync_cursors WHERE runtime_id = $1 AND stream = 'observe'`,
      [runtimeId],
    );
    const minSeq = Number(cursor.rows[0]?.min_seq ?? 1);
    if (after < minSeq - 1) {
      return {
        ok: false,
        status: 409,
        body: errorBody(errorCodes.resyncRequired, "cursor is outside retention"),
      };
    }
  }
  const runs = await pool.query<{
    run_id: string;
    status: string;
    events_json: { sequence?: number; type?: string; nodeId?: string }[] | null;
  }>(
    `SELECT run_id, status, events_json FROM run_summaries WHERE site_id = $1 ORDER BY updated_at DESC LIMIT 100`,
    [actor.siteId],
  );
  const samples = await pool.query<{
    field_id: string;
    ts: Date;
    value: number;
  }>(
    `SELECT field_id, ts, value FROM observe_samples WHERE site_id = $1 ORDER BY ts ASC LIMIT 500`,
    [actor.siteId],
  );
  const body: AnalyticsSnapshot = {
    series: seriesOf(samples.rows),
    runCounts: {
      total: runs.rows.length,
      succeeded: runs.rows.filter((row) => row.status === "completed").length,
      failed: runs.rows.filter((row) => row.status === "failed").length,
    },
    nodeDurations: nodeDurationsOf(runs.rows),
    recentErrors: recentErrorsOf(runs.rows),
  };
  return { ok: true, status: 200, body };
};

const seriesOf = (rows: readonly { field_id: string; ts: Date; value: number }[]) => {
  const grouped = new Map<string, { ts: string; value: number }[]>();
  for (const row of rows) {
    const list = grouped.get(row.field_id) ?? [];
    list.push({ ts: row.ts.toISOString(), value: row.value });
    grouped.set(row.field_id, list);
  }
  return [...grouped.entries()].map(([fieldId, points]) => ({ fieldId, points }));
};

const nodeDurationsOf = (
  rows: readonly { events_json: { nodeId?: string }[] | null }[],
) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const event of row.events_json ?? []) {
      if (!event.nodeId) {
        continue;
      }
      counts.set(event.nodeId, (counts.get(event.nodeId) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([nodeId, events]) => ({ nodeId, events }));
};

const recentErrorsOf = (
  rows: readonly {
    run_id: string;
    events_json: { type?: string; nodeId?: string }[] | null;
  }[],
) =>
  rows.flatMap((row) =>
    (row.events_json ?? [])
      .filter((event) => event.type?.includes("failed"))
      .map((event) => ({
        runId: row.run_id,
        type: event.type ?? "failed",
        ...(event.nodeId ? { nodeId: event.nodeId } : {}),
      })),
  ).slice(0, 20);
