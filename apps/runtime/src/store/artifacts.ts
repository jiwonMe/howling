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
  },
): StoredArtifact => {
  const digest = sha256Json(input.definition);
  db.prepare(
    `INSERT INTO revision_artifacts
       (id, flow_id, revision, definition_json, digest, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       definition_json = excluded.definition_json,
       digest = excluded.digest`,
  ).run(
    input.id,
    input.definition.id,
    input.definition.revision,
    JSON.stringify(input.definition),
    digest,
    new Date().toISOString(),
  );
  db.prepare(
    `INSERT INTO active_deployments
       (flow_id, artifact_id, generation, state_epoch, created_at)
     VALUES (?, ?, 1, 'epoch_1', ?)
     ON CONFLICT (flow_id) DO UPDATE SET artifact_id = excluded.artifact_id`,
  ).run(input.definition.id, input.id, new Date().toISOString());
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
): { artifactId: string; stateEpoch: string } | undefined => {
  const row = db
    .prepare(
      `SELECT artifact_id, state_epoch FROM active_deployments WHERE flow_id = ?`,
    )
    .get(flowId) as { artifact_id: string; state_epoch: string } | undefined;
  if (!row) {
    return undefined;
  }
  return { artifactId: row.artifact_id, stateEpoch: row.state_epoch };
};
