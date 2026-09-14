/**
 * 같은 idempotency key는 같은 응답을 돌려준다.
 */
import type pg from "pg";
import { artifactDigest } from "./digest.js";

export const recallIdempotency = async (
  pool: pg.Pool,
  siteId: string,
  key: string,
  kind: string,
  body: unknown,
): Promise<{ hit: true; response: unknown } | { hit: false }> => {
  const hash = artifactDigest(body);
  const result = await pool.query<{ body_hash: string; response_json: unknown }>(
    `SELECT body_hash, response_json FROM flow_idempotency
     WHERE site_id = $1 AND key = $2 AND kind = $3`,
    [siteId, key, kind],
  );
  const row = result.rows[0];
  if (!row) {
    return { hit: false };
  }
  if (row.body_hash !== hash) {
    throw new Error("conflict");
  }
  return { hit: true, response: row.response_json };
};

export const putIdempotency = async (
  pool: pg.Pool,
  siteId: string,
  key: string,
  kind: string,
  body: unknown,
  response: unknown,
): Promise<void> => {
  await pool.query(
    `INSERT INTO flow_idempotency (site_id, key, kind, body_hash, response_json, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now())
     ON CONFLICT (site_id, key) DO NOTHING`,
    [siteId, key, kind, artifactDigest(body), JSON.stringify(response)],
  );
};
