/**
 * 기간·용량. 진행 중 snapshot·미해소 outbox·활성 artifact는 남긴다.
 */
import type Database from "better-sqlite3";
import { getDeployment } from "../store/artifacts.js";
import { listOpenRuns } from "../store/runs.js";
import { tombstoneUnacked } from "../store/sync-journal.js";
import { getLocalPolicy } from "./policy.js";

export const retainLocal = (db: Database.Database, now = Date.now()): number => {
  const { policy } = getLocalPolicy(db);
  const cutoff = new Date(now - policy.localRetentionDays * 86_400_000).toISOString();
  const blocked = blockedRuns(db);
  const over = payloadBytes(db) > policy.capacityBytes;
  const rows = db
    .prepare(
      `SELECT run_id, updated_at FROM run_snapshots
       WHERE status IN ('completed', 'failed', 'cancelled')
       ORDER BY updated_at ASC`,
    )
    .all() as { run_id: string; updated_at: string }[];
  let purged = 0;
  for (const row of rows) {
    if (blocked.has(row.run_id)) {
      continue;
    }
    if (row.updated_at > cutoff && !over) {
      continue;
    }
    const events = db
      .prepare(`SELECT sequence FROM run_events WHERE run_id = ?`)
      .all(row.run_id) as { sequence: number }[];
    const update = db.prepare(`UPDATE run_events SET event_json = ? WHERE run_id = ? AND sequence = ?`);
    for (const event of events) {
      update.run(
        JSON.stringify({
          runId: row.run_id,
          sequence: event.sequence,
          type: "purged",
          logicalTime: 0,
        }),
        row.run_id,
        event.sequence,
      );
    }
    db.prepare(`DELETE FROM observation_samples WHERE run_id = ?`).run(row.run_id);
    purged += 1;
    if (over && payloadBytes(db) <= policy.capacityBytes) {
      break;
    }
  }
  tombstoneUnacked(db, "raw");
  return purged;
};

const blockedRuns = (db: Database.Database): Set<string> => {
  const blocked = new Set(listOpenRuns(db).map((row) => row.runId));
  const pending = db
    .prepare(
      `SELECT DISTINCT run_id FROM effect_outbox
       WHERE status NOT IN ('succeeded', 'failed')`,
    )
    .all() as { run_id: string }[];
  for (const row of pending) {
    blocked.add(row.run_id);
  }
  const flows = db.prepare(`SELECT flow_id FROM active_deployments`).all() as { flow_id: string }[];
  for (const flow of flows) {
    const deployment = getDeployment(db, flow.flow_id);
    if (deployment) {
      blocked.add(deployment.artifactId);
    }
  }
  return blocked;
};

const payloadBytes = (db: Database.Database): number => {
  const events = db.prepare(`SELECT SUM(LENGTH(event_json)) AS n FROM run_events`).get() as {
    n: number | null;
  };
  const samples = db
    .prepare(`SELECT SUM(LENGTH(CAST(value AS TEXT))) AS n FROM observation_samples`)
    .get() as { n: number | null };
  return (events.n ?? 0) + (samples.n ?? 0);
};
