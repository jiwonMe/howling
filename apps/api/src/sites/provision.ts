/**
 * 단계 0 bootstrap site와 첫 로그인 owner 연결.
 */
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { ApiConfig } from "../config.js";
import { hashToken } from "../crypto.js";

export const seedBootstrap = async (
  pool: pg.Pool,
  config: ApiConfig,
): Promise<void> => {
  await pool.query(
    `INSERT INTO sites (id, name, created_at)
     VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [config.bootstrapSiteId, config.bootstrapSiteName],
  );
  if (!config.bootstrapRuntimeToken) {
    return;
  }
  await pool.query(
    `INSERT INTO runtime_registrations
       (id, site_id, runtime_id, token_hash, connection_generation, online, created_at)
     VALUES ($1, $2, $3, $4, 0, FALSE, now())
     ON CONFLICT (site_id) DO UPDATE
       SET runtime_id = EXCLUDED.runtime_id,
           token_hash = EXCLUDED.token_hash`,
    [
      "reg_bootstrap",
      config.bootstrapSiteId,
      config.bootstrapRuntimeId,
      hashToken(config.bootstrapRuntimeToken),
    ],
  );
};

export const upsertUser = async (
  pool: pg.Pool,
  input: {
    readonly issuer: string;
    readonly subject: string;
    readonly email: string | null;
  },
): Promise<string> => {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE oidc_issuer = $1 AND oidc_subject = $2`,
    [input.issuer, input.subject],
  );
  const found = existing.rows[0];
  if (found) {
    await pool.query(`UPDATE users SET email = $1 WHERE id = $2`, [
      input.email,
      found.id,
    ]);
    return found.id;
  }
  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, oidc_issuer, oidc_subject, email, created_at)
     VALUES ($1, $2, $3, $4, now())`,
    [id, input.issuer, input.subject, input.email],
  );
  return id;
};

export const attachOwner = async (
  pool: pg.Pool,
  siteId: string,
  userId: string,
): Promise<void> => {
  await pool.query(
    `INSERT INTO memberships (site_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (site_id, user_id) DO NOTHING`,
    [siteId, userId],
  );
};
