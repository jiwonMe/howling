/**
 * Scoped token 저장. 원문 컬럼은 없다.
 */
import { randomUUID } from "node:crypto";
import type { Permission, TokenListItem } from "@howling/contracts";
import type pg from "pg";
import { hashToken, randomToken } from "../crypto.js";

export const issueToken = async (
  pool: pg.Pool,
  input: {
    readonly siteId: string;
    readonly userId: string;
    readonly name: string;
    readonly scopes: readonly Permission[];
    readonly flowId?: string;
  },
): Promise<{ id: string; token: string }> => {
  const id = randomUUID();
  const token = `hwl_${randomToken()}`;
  await pool.query(
    `INSERT INTO api_tokens
       (id, site_id, user_id, name, token_hash, scopes, flow_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [id, input.siteId, input.userId, input.name, hashToken(token), input.scopes, input.flowId ?? null],
  );
  return { id, token };
};

export const listTokens = async (pool: pg.Pool, siteId: string): Promise<TokenListItem[]> => {
  const result = await pool.query(
    `SELECT id, name, scopes, flow_id, created_at, last_used_at, revoked_at
     FROM api_tokens WHERE site_id = $1 ORDER BY created_at DESC`,
    [siteId],
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    scopes: row.scopes as Permission[],
    flowId: (row.flow_id as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    lastUsedAt: row.last_used_at ? (row.last_used_at as Date).toISOString() : null,
    revokedAt: row.revoked_at ? (row.revoked_at as Date).toISOString() : null,
  }));
};

export const revokeToken = async (
  pool: pg.Pool,
  siteId: string,
  tokenId: string,
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE api_tokens SET revoked_at = now()
     WHERE id = $1 AND site_id = $2 AND revoked_at IS NULL`,
    [tokenId, siteId],
  );
  return (result.rowCount ?? 0) === 1;
};

export const resolveToken = async (
  pool: pg.Pool,
  raw: string,
): Promise<
  | {
      readonly siteId: string;
      readonly userId: string;
      readonly scopes: readonly Permission[];
      readonly flowId?: string;
    }
  | undefined
> => {
  const result = await pool.query(
    `SELECT id, site_id, user_id, scopes, flow_id, revoked_at
     FROM api_tokens WHERE token_hash = $1`,
    [hashToken(raw)],
  );
  const row = result.rows[0];
  if (!row || row.revoked_at) {
    return undefined;
  }
  await pool.query(`UPDATE api_tokens SET last_used_at = now() WHERE id = $1`, [row.id]);
  return {
    siteId: row.site_id as string,
    userId: row.user_id as string,
    scopes: row.scopes as Permission[],
    ...(row.flow_id ? { flowId: row.flow_id as string } : {}),
  };
};
