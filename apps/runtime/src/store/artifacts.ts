/**
 * 시드 artifact와 활성 revision 포인터.
 */
import type { ExecutionPolicy } from "@howling/contracts";
import type { WorkflowDefinition } from "@howling/core";
import type Database from "better-sqlite3";
import { sha256Json } from "./hash.js";

const defaultPolicy: ExecutionPolicy = { mode: "live", captureRaw: false };

export interface StoredArtifact {
  readonly id: string;
  readonly flowId: string;
  readonly revision: string;
  readonly definition: WorkflowDefinition;
  readonly digest: string;
  readonly executionPolicy: ExecutionPolicy;
}

export const storeArtifact = (
  db: Database.Database,
  input: {
    readonly id: string;
    readonly definition: WorkflowDefinition;
    readonly triggers?: unknown;
    readonly connections?: unknown;
    readonly executionPolicy?: ExecutionPolicy;
  },
): StoredArtifact => {
  const digest = sha256Json(input.definition);
  const executionPolicy = input.executionPolicy ?? defaultPolicy;
  db.prepare(
    `INSERT INTO revision_artifacts
       (id, flow_id, revision, definition_json, digest, created_at, triggers_json, connections_json, execution_policy_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       definition_json = excluded.definition_json,
       digest = excluded.digest,
       triggers_json = excluded.triggers_json,
       connections_json = excluded.connections_json,
       execution_policy_json = excluded.execution_policy_json`,
  ).run(
    input.id,
    input.definition.id,
    input.definition.revision,
    JSON.stringify(input.definition),
    digest,
    new Date().toISOString(),
    JSON.stringify(input.triggers ?? []),
    JSON.stringify(input.connections ?? []),
    JSON.stringify(executionPolicy),
  );
  return {
    id: input.id,
    flowId: input.definition.id,
    revision: input.definition.revision,
    definition: input.definition,
    digest,
    executionPolicy,
  };
};

export const nextStateEpoch = (current?: string): string => {
  const match = /^epoch_(\d+)$/.exec(current ?? "");
  const n = match ? Number(match[1]) : 0;
  return `epoch_${String(n + 1)}`;
};

export const activatePointer = (
  db: Database.Database,
  input: {
    readonly flowId: string;
    readonly artifactId: string;
    readonly generation: number;
    readonly stateEpoch: string;
  },
): void => {
  db.prepare(
    `INSERT INTO active_deployments
       (flow_id, artifact_id, generation, state_epoch, created_at, inactive)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT (flow_id) DO UPDATE SET
       artifact_id = excluded.artifact_id,
       generation = excluded.generation,
       state_epoch = excluded.state_epoch,
       inactive = 0
     WHERE excluded.generation >= active_deployments.generation`,
  ).run(
    input.flowId,
    input.artifactId,
    input.generation,
    input.stateEpoch,
    new Date().toISOString(),
  );
};

export const deactivatePointer = (
  db: Database.Database,
  flowId: string,
  generation: number,
): void => {
  db.prepare(
    `UPDATE active_deployments
     SET inactive = 1, generation = ?
     WHERE flow_id = ? AND generation <= ?`,
  ).run(generation, flowId, generation);
};

export const lastGeneration = (db: Database.Database, flowId: string): number | undefined => {
  const row = db
    .prepare(`SELECT generation FROM active_deployments WHERE flow_id = ?`)
    .get(flowId) as { generation: number } | undefined;
  return row?.generation;
};

export const upsertArtifact = (
  db: Database.Database,
  input: {
    readonly id: string;
    readonly definition: WorkflowDefinition;
    readonly triggers?: unknown;
    readonly connections?: unknown;
    readonly executionPolicy?: ExecutionPolicy;
    readonly generation?: number;
    readonly activate?: boolean;
    readonly stateEpoch?: string;
  },
): StoredArtifact => {
  const stored = storeArtifact(db, input);
  if (input.activate === false) {
    return stored;
  }
  activatePointer(db, {
    flowId: input.definition.id,
    artifactId: input.id,
    generation: input.generation ?? 1,
    stateEpoch: input.stateEpoch ?? "epoch_1",
  });
  return stored;
};

export const getArtifact = (
  db: Database.Database,
  id: string,
): StoredArtifact | undefined => {
  const row = db
    .prepare(
      `SELECT id, flow_id, revision, definition_json, digest, execution_policy_json
       FROM revision_artifacts WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        flow_id: string;
        revision: string;
        definition_json: string;
        digest: string;
        execution_policy_json?: string;
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
    executionPolicy: row.execution_policy_json
      ? (JSON.parse(row.execution_policy_json) as ExecutionPolicy)
      : defaultPolicy,
  };
};

export const getDeployment = (
  db: Database.Database,
  flowId: string,
): { artifactId: string; stateEpoch: string; generation: number } | undefined => {
  const row = db
    .prepare(
      `SELECT artifact_id, state_epoch, generation FROM active_deployments
       WHERE flow_id = ? AND inactive = 0`,
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
      `SELECT a.id, a.flow_id, a.revision, a.definition_json, a.digest, a.triggers_json, a.execution_policy_json
       FROM revision_artifacts a
       JOIN active_deployments d ON d.artifact_id = a.id
       WHERE d.inactive = 0`,
    )
    .all() as {
    id: string;
    flow_id: string;
    revision: string;
    definition_json: string;
    digest: string;
    triggers_json: string;
    execution_policy_json?: string;
  }[];
  return rows.map((row) => ({
    artifact: {
      id: row.id,
      flowId: row.flow_id,
      revision: row.revision,
      definition: JSON.parse(row.definition_json) as WorkflowDefinition,
      digest: row.digest,
      executionPolicy: row.execution_policy_json
        ? (JSON.parse(row.execution_policy_json) as ExecutionPolicy)
        : defaultPolicy,
    },
    triggers: JSON.parse(row.triggers_json) as unknown,
  }));
};
