/**
 * Run snapshot과 실행권.
 */
import type { ExecutionSnapshot } from "@howling/core";
import type { RunStatus } from "./core-types.js";
import type Database from "better-sqlite3";
import type { ProgressionMode } from "./triggers.js";

export interface RunRow {
  readonly runId: string;
  readonly flowId: string;
  readonly artifactId: string;
  readonly snapshot: ExecutionSnapshot;
  readonly status: RunStatus;
  readonly progressionMode: ProgressionMode;
  readonly holding: boolean;
  readonly stateEpoch: string;
  readonly lastEventSeq: number;
}

export const upsertRun = (
  db: Database.Database,
  row: RunRow,
): void => {
  db.prepare(
    `INSERT INTO run_snapshots
       (run_id, flow_id, artifact_id, snapshot_json, status, progression_mode,
        holding, state_epoch, last_event_seq, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (run_id) DO UPDATE SET
       snapshot_json = excluded.snapshot_json,
       status = excluded.status,
       progression_mode = excluded.progression_mode,
       holding = excluded.holding,
       last_event_seq = excluded.last_event_seq,
       updated_at = excluded.updated_at`,
  ).run(
    row.runId,
    row.flowId,
    row.artifactId,
    JSON.stringify(row.snapshot),
    row.status,
    row.progressionMode,
    row.holding ? 1 : 0,
    row.stateEpoch,
    row.lastEventSeq,
    new Date().toISOString(),
  );
};

export const getRun = (
  db: Database.Database,
  runId: string,
): RunRow | undefined => mapRun(
  db.prepare(`SELECT * FROM run_snapshots WHERE run_id = ?`).get(runId),
);

export const holdingRun = (
  db: Database.Database,
  flowId: string,
): RunRow | undefined =>
  mapRun(
    db
      .prepare(
        `SELECT * FROM run_snapshots WHERE flow_id = ? AND holding = 1 LIMIT 1`,
      )
      .get(flowId),
  );

export const listOpenRuns = (db: Database.Database): RunRow[] => {
  const rows = db
    .prepare(
      `SELECT * FROM run_snapshots
       WHERE status IN ('running', 'paused', 'waiting')`,
    )
    .all();
  return rows.flatMap((row) => {
    const mapped = mapRun(row);
    return mapped ? [mapped] : [];
  });
};

export const setProgressionMode = (
  db: Database.Database,
  runId: string,
  mode: ProgressionMode,
): void => {
  db.prepare(
    `UPDATE run_snapshots SET progression_mode = ?, updated_at = ? WHERE run_id = ?`,
  ).run(mode, new Date().toISOString(), runId);
};

const mapRun = (row: unknown): RunRow | undefined => {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  const value = row as {
    run_id: string;
    flow_id: string;
    artifact_id: string;
    snapshot_json: string;
    status: RunStatus;
    progression_mode: ProgressionMode;
    holding: number;
    state_epoch: string;
    last_event_seq: number;
  };
  return {
    runId: value.run_id,
    flowId: value.flow_id,
    artifactId: value.artifact_id,
    snapshot: JSON.parse(value.snapshot_json) as ExecutionSnapshot,
    status: value.status,
    progressionMode: value.progression_mode,
    holding: value.holding === 1,
    stateEpoch: value.state_epoch,
    lastEventSeq: value.last_event_seq,
  };
};
