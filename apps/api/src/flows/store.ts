/**
 * Flow draft·revision·deployment·run 저장.
 */
import { randomUUID } from "node:crypto";
import type { RevisionArtifact } from "@howling/contracts";
import type pg from "pg";
import { artifactDigest } from "./digest.js";

export const listFlows = async (pool: pg.Pool, siteId: string) => {
  const result = await pool.query(
    `SELECT d.id, d.name, d.version,
            (SELECT r.id FROM flow_revisions r WHERE r.flow_id = d.id ORDER BY r.created_at DESC LIMIT 1) AS revision_id,
            (SELECT dep.status FROM deployments dep WHERE dep.flow_id = d.id ORDER BY dep.generation DESC LIMIT 1) AS deploy_status
     FROM flow_drafts d WHERE d.site_id = $1 ORDER BY d.updated_at DESC`,
    [siteId],
  );
  return result.rows;
};

export const createFlow = async (pool: pg.Pool, siteId: string, name: string) => {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO flow_drafts
       (id, site_id, version, name, definition_json, triggers_json, connections_json, execution_policy_json, updated_at)
     VALUES ($1, $2, 1, $3, $4::jsonb, '[]'::jsonb, '[]'::jsonb, $5::jsonb, now())`,
    [
      id,
      siteId,
      name,
      JSON.stringify({
        schemaVersion: 1,
        id,
        revision: "draft",
        entryNodeId: "input",
        nodes: [],
        edges: [],
      }),
      JSON.stringify({ mode: "live", captureRaw: false }),
    ],
  );
  await pool.query(
    `INSERT INTO editor_documents (flow_id, version, positions_json, groups_json, viewport_json, updated_at)
     VALUES ($1, 1, '{}'::jsonb, '[]'::jsonb, '{"x":0,"y":0,"zoom":1}'::jsonb, now())`,
    [id],
  );
  return id;
};

export const getFlow = async (pool: pg.Pool, siteId: string, flowId: string) => {
  const draft = await pool.query(`SELECT * FROM flow_drafts WHERE id = $1 AND site_id = $2`, [
    flowId,
    siteId,
  ]);
  const editor = await pool.query(`SELECT * FROM editor_documents WHERE flow_id = $1`, [flowId]);
  const deploy = await pool.query(
    `SELECT * FROM deployments WHERE flow_id = $1 ORDER BY generation DESC LIMIT 1`,
    [flowId],
  );
  if (!draft.rows[0]) {
    return undefined;
  }
  return { draft: draft.rows[0], editor: editor.rows[0], deployment: deploy.rows[0] };
};

export const saveDraft = async (
  pool: pg.Pool,
  input: {
    readonly siteId: string;
    readonly flowId: string;
    readonly expectedVersion: number;
    readonly definition: unknown;
    readonly triggers: unknown;
    readonly connections: unknown;
    readonly executionPolicy: unknown;
  },
): Promise<"ok" | "conflict" | "missing"> => {
  const result = await pool.query(
    `UPDATE flow_drafts
     SET version = version + 1,
         definition_json = $4::jsonb,
         triggers_json = $5::jsonb,
         connections_json = $6::jsonb,
         execution_policy_json = $7::jsonb,
         updated_at = now()
     WHERE id = $1 AND site_id = $2 AND version = $3`,
    [
      input.flowId,
      input.siteId,
      input.expectedVersion,
      JSON.stringify(input.definition),
      JSON.stringify(input.triggers),
      JSON.stringify(input.connections),
      JSON.stringify(input.executionPolicy),
    ],
  );
  if ((result.rowCount ?? 0) === 1) {
    return "ok";
  }
  const exists = await pool.query(`SELECT 1 FROM flow_drafts WHERE id = $1 AND site_id = $2`, [
    input.flowId,
    input.siteId,
  ]);
  return (exists.rowCount ?? 0) === 0 ? "missing" : "conflict";
};

export const saveEditor = async (
  pool: pg.Pool,
  input: {
    readonly flowId: string;
    readonly expectedVersion: number;
    readonly positions: unknown;
    readonly groups: unknown;
    readonly viewport: unknown;
  },
): Promise<"ok" | "conflict" | "missing"> => {
  const result = await pool.query(
    `UPDATE editor_documents
     SET version = version + 1,
         positions_json = $3::jsonb,
         groups_json = $4::jsonb,
         viewport_json = $5::jsonb,
         updated_at = now()
     WHERE flow_id = $1 AND version = $2`,
    [
      input.flowId,
      input.expectedVersion,
      JSON.stringify(input.positions),
      JSON.stringify(input.groups),
      JSON.stringify(input.viewport),
    ],
  );
  if ((result.rowCount ?? 0) === 1) {
    return "ok";
  }
  const exists = await pool.query(`SELECT 1 FROM editor_documents WHERE flow_id = $1`, [
    input.flowId,
  ]);
  return (exists.rowCount ?? 0) === 0 ? "missing" : "conflict";
};

export const insertRevision = async (
  pool: pg.Pool,
  siteId: string,
  flowId: string,
  artifact: RevisionArtifact,
) => {
  await pool.query(
    `INSERT INTO flow_revisions (id, flow_id, site_id, artifact_json, digest, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, now())`,
    [artifact.revisionId, flowId, siteId, JSON.stringify(artifact), artifact.artifactDigest],
  );
};

export const getRevision = async (pool: pg.Pool, revisionId: string) => {
  const result = await pool.query<{ artifact_json: RevisionArtifact }>(
    `SELECT artifact_json FROM flow_revisions WHERE id = $1`,
    [revisionId],
  );
  return result.rows[0]?.artifact_json;
};

export const insertDeployment = async (
  pool: pg.Pool,
  input: {
    readonly siteId: string;
    readonly flowId: string;
    readonly revisionId: string;
  },
) => {
  const last = await pool.query<{ generation: number }>(
    `SELECT COALESCE(MAX(generation), 0) AS generation FROM deployments WHERE flow_id = $1`,
    [input.flowId],
  );
  const generation = (last.rows[0]?.generation ?? 0) + 1;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO deployments (id, flow_id, site_id, revision_id, generation, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'requested', now())`,
    [id, input.flowId, input.siteId, input.revisionId, generation],
  );
  return { id, generation };
};

export const setDeploymentStatus = async (
  pool: pg.Pool,
  deploymentId: string,
  status: string,
  error?: string,
) => {
  await pool.query(
    `UPDATE deployments SET status = $2, error = $3 WHERE id = $1`,
    [deploymentId, status, error ?? null],
  );
};

export const digestOf = artifactDigest;
