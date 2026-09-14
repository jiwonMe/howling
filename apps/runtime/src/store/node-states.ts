/**
 * Live 분석 상태. (runId, eventSequence)로 한 번만 적용한다.
 */
import type { JsonValue } from "@howling/core";
import type Database from "better-sqlite3";

export const loadNodeStates = (
  db: Database.Database,
  input: {
    readonly flowId: string;
    readonly revision: string;
    readonly stateEpoch: string;
  },
): Record<string, JsonValue> => {
  const rows = db
    .prepare(
      `SELECT node_id, state_json FROM node_states
       WHERE flow_id = ? AND revision = ? AND state_epoch = ?`,
    )
    .all(input.flowId, input.revision, input.stateEpoch) as {
    node_id: string;
    state_json: string;
  }[];
  return Object.fromEntries(
    rows.map((row) => [row.node_id, JSON.parse(row.state_json) as JsonValue]),
  );
};

export const applyStateUpdate = (
  db: Database.Database,
  input: {
    readonly flowId: string;
    readonly revision: string;
    readonly stateEpoch: string;
    readonly nodeId: string;
    readonly nextState: JsonValue;
    readonly runId: string;
    readonly sequence: number;
  },
): void => {
  const seen = db
    .prepare(
      `SELECT 1 FROM node_state_applies WHERE run_id = ? AND event_sequence = ?`,
    )
    .get(input.runId, input.sequence);
  if (seen) {
    return;
  }
  db.prepare(
    `INSERT INTO node_state_applies (run_id, event_sequence) VALUES (?, ?)`,
  ).run(input.runId, input.sequence);
  db.prepare(
    `INSERT INTO node_states
       (flow_id, revision, state_epoch, node_id, state_json, source_run_id, source_sequence)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (flow_id, revision, state_epoch, node_id) DO UPDATE SET
       state_json = excluded.state_json,
       source_run_id = excluded.source_run_id,
       source_sequence = excluded.source_sequence`,
  ).run(
    input.flowId,
    input.revision,
    input.stateEpoch,
    input.nodeId,
    JSON.stringify(input.nextState),
    input.runId,
    input.sequence,
  );
};
