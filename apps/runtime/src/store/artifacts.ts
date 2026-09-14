/**
 * 시드 artifact와 활성 revision 포인터.
 */
import type { WorkflowDefinition } from "@howling/core";
import type Database from "better-sqlite3";
import { sha256Json } from "./hash.js";

export interface StoredArtifact {
  readonly id: string;
  readonly flowId: string;
  readonly revision: string;
  readonly definition: WorkflowDefinition;
  readonly digest: string;
}

export const upsertArtifact = (
  db: Database.Database,
  input: {
    readonly id: string;
    readonly definition: WorkflowDefinition;
    readonly triggers?: unknown;
    readonly connections?: unknown;
    readonly generation?: number;
  },
): StoredArtifact => {
  const digest = sha256Json(input.definition);
  db.prepare(
    `INSERT INTO revision_artifacts
       (id, flow_id, revision, definition_json, digest, created_at, triggers_json, connections_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       definition_json = excluded.definition_json,
       digest = excluded.digest,
       triggers_json = excluded.triggers_json,
       connections_json = excluded.connections_json`,
  ).run(
    input.id,
    input.definition.id,
    input.definition.revision,
    JSON.stringify(input.definition),
    digest,
    new Date().toISOString(),
    JSON.stringify(input.triggers ?? []),
    JSON.stringify(input.connections ?? []),
  );
  const generation = input.generation ?? 1;
  db.prepare(
    `INSERT INTO active_deployments
       (flow_id, artifact_id, generation, state_epoch, created_at)
     VALUES (?, ?, ?, 'epoch_1', ?)
     ON CONFLICT (flow_id) DO UPDATE SET
       artifact_id = excluded.artifact_id,
       generation = excluded.generation
     WHERE excluded.generation >= active_deployments.generation`,
  ).run(input.definition.id, input.id, generation, new Date().toISOString());
  return {
    id: input.id,
    flowId: input.definition.id,
    revision: input.definition.revision,
    definition: input.definition,
    digest,
  };
};

export const getArtifact = (
  db: Database.Database,
  id: string,
): StoredArtifact | undefined => {
  const row = db
    .prepare(
      `SELECT id, flow_id, revision, definition_json, digest
       FROM revision_artifacts WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        flow_id: string;
        revision: string;
        definition_json: string;
        digest: string;
      }
    | undefined;
  if (!row) {
    return undefined;
  }
  return {
    id: row.id,
    flowId: row.flow_id,
    revision: row.revision,
    definition: JSON.parse(row.definition_json) as WorkflowDefinition,
    digest: row.digest,
  };
};

export const getDeployment = (
  db: Database.Database,
  flowId: string,
): { artifactId: string; stateEpoch: string; generation: number } | undefined => {
  const row = db
    .prepare(
      `SELECT artifact_id, state_epoch, generation FROM active_deployments WHERE flow_id = ?`,
    )
    .get(flowId) as
    | { artifact_id: string; state_epoch: string; generation: number }
    | undefined;
  if (!row) {
    return undefined;
  }
  return {
    artifactId: row.artifact_id,
    stateEpoch: row.state_epoch,
    generation: row.generation,
  };
};

export const listActiveArtifacts = (
  db: Database.Database,
): { artifact: StoredArtifact; triggers: unknown }[] => {
  const rows = db
    .prepare(
      `SELECT a.id, a.flow_id, a.revision, a.definition_json, a.digest, a.triggers_json
       FROM revision_artifacts a
       JOIN active_deployments d ON d.artifact_id = a.id`,
    )
    .all() as {
    id: string;
    flow_id: string;
    revision: string;
    definition_json: string;
    digest: string;
    triggers_json: string;
  }[];
  return rows.map((row) => ({
    artifact: {
      id: row.id,
      flowId: row.flow_id,
      revision: row.revision,
      definition: JSON.parse(row.definition_json) as WorkflowDefinition,
      digest: row.digest,
    },
    triggers: JSON.parse(row.triggers_json) as unknown,
  }));
};
