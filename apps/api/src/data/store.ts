/**
 * site 보관 정책과 관측 필드.
 */
import { randomUUID } from "node:crypto";
import { DEFAULT_DATA_POLICY, type ObservationSpec, type SiteDataPolicy } from "@howling/contracts";
import type pg from "pg";

export const getDataPolicy = async (pool: pg.Pool, siteId: string): Promise<SiteDataPolicy> => {
  const result = await pool.query<{ policy_json: SiteDataPolicy }>(
    `SELECT policy_json FROM site_data_policies WHERE site_id = $1`,
    [siteId],
  );
  return result.rows[0]?.policy_json ?? { ...DEFAULT_DATA_POLICY };
};

export const putDataPolicy = async (
  pool: pg.Pool,
  siteId: string,
  policy: SiteDataPolicy,
): Promise<SiteDataPolicy> => {
  await pool.query(
    `INSERT INTO site_data_policies (site_id, policy_json, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (site_id) DO UPDATE SET policy_json = EXCLUDED.policy_json, updated_at = now()`,
    [siteId, JSON.stringify(policy)],
  );
  return policy;
};

export const getObservations = async (pool: pg.Pool, siteId: string): Promise<ObservationSpec> => {
  const result = await pool.query<{ spec_json: ObservationSpec }>(
    `SELECT spec_json FROM observation_specs WHERE site_id = $1`,
    [siteId],
  );
  return result.rows[0]?.spec_json ?? { fields: [] };
};

export const putObservations = async (
  pool: pg.Pool,
  siteId: string,
  spec: ObservationSpec,
): Promise<ObservationSpec> => {
  await pool.query(
    `INSERT INTO observation_specs (site_id, spec_json, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (site_id) DO UPDATE SET spec_json = EXCLUDED.spec_json, updated_at = now()`,
    [siteId, JSON.stringify(spec)],
  );
  return spec;
};

export const insertObserveSamples = async (
  pool: pg.Pool,
  siteId: string,
  items: readonly {
    readonly fieldId: string;
    readonly ts: string;
    readonly value: number;
    readonly kind: string;
    readonly runId?: string;
    readonly nodeId?: string;
  }[],
): Promise<void> => {
  for (const item of items) {
    await pool.query(
      `INSERT INTO observe_samples (site_id, field_id, ts, value, kind, run_id, node_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (site_id, field_id, ts) DO NOTHING`,
      [siteId, item.fieldId, item.ts, item.value, item.kind, item.runId ?? null, item.nodeId ?? null],
    );
  }
};

export const insertDetailAudit = async (
  pool: pg.Pool,
  input: {
    readonly siteId: string;
    readonly runId: string;
    readonly nodeId?: string;
    readonly field?: string;
  },
): Promise<void> => {
  await pool.query(
    `INSERT INTO detail_audits (id, site_id, run_id, node_id, field, created_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [randomUUID(), input.siteId, input.runId, input.nodeId ?? null, input.field ?? null],
  );
};

export const lastSyncAt = async (pool: pg.Pool, runtimeId: string): Promise<string | null> => {
  const result = await pool.query<{ created_at: Date }>(
    `SELECT created_at FROM sync_journal WHERE runtime_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [runtimeId],
  );
  return result.rows[0]?.created_at.toISOString() ?? null;
};
