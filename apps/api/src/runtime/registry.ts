/**
 * Runtime 자격증명과 온라인 상태.
 */
import { HEARTBEAT_TIMEOUT_MS } from "@howling/contracts";
import type pg from "pg";
import { hashToken } from "../crypto.js";

export interface RuntimeIdentity {
  readonly siteId: string;
  readonly runtimeId: string;
}

export const authenticateRuntime = async (
  pool: pg.Pool,
  token: string,
): Promise<RuntimeIdentity | undefined> => {
  const result = await pool.query<RuntimeIdentity>(
    `SELECT site_id AS "siteId", runtime_id AS "runtimeId"
     FROM runtime_registrations
     WHERE token_hash = $1`,
    [hashToken(token)],
  );
  return result.rows[0];
};

export const markRuntimeHello = async (
  pool: pg.Pool,
  input: {
    readonly runtimeId: string;
    readonly generation: number;
    readonly capabilities: unknown;
  },
): Promise<void> => {
  await pool.query(
    `UPDATE runtime_registrations
     SET online = TRUE,
         connection_generation = $2,
         last_seen_at = now(),
         capabilities = COALESCE(capabilities, '{}'::jsonb) || $3::jsonb
     WHERE runtime_id = $1`,
    [input.runtimeId, input.generation, JSON.stringify(input.capabilities)],
  );
};

export const touchRuntime = async (
  pool: pg.Pool,
  runtimeId: string,
): Promise<void> => {
  await pool.query(
    `UPDATE runtime_registrations
     SET last_seen_at = now(), online = TRUE
     WHERE runtime_id = $1`,
    [runtimeId],
  );
};

export const markRuntimeOffline = async (
  pool: pg.Pool,
  runtimeId: string,
  generation?: number,
): Promise<void> => {
  if (generation === undefined) {
    await pool.query(
      `UPDATE runtime_registrations SET online = FALSE WHERE runtime_id = $1`,
      [runtimeId],
    );
    return;
  }
  await pool.query(
    `UPDATE runtime_registrations
     SET online = FALSE
     WHERE runtime_id = $1 AND connection_generation = $2`,
    [runtimeId, generation],
  );
};

export const expireSilentRuntimes = async (pool: pg.Pool): Promise<void> => {
  await pool.query(
    `UPDATE runtime_registrations
     SET online = FALSE
     WHERE online = TRUE
       AND last_seen_at IS NOT NULL
       AND last_seen_at < now() - ($1::text || ' milliseconds')::interval`,
    [String(HEARTBEAT_TIMEOUT_MS)],
  );
};
