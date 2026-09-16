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
           token_hash = EXCLUDED.token_hash
     WHERE runtime_registrations.runtime_id = EXCLUDED.runtime_id`,
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

const sameEmail = (left: string | null, right: string): boolean =>
  left !== null && left.trim().toLowerCase() === right.trim().toLowerCase();

/**
 * 첫 로그인 = 회원가입. membership이 없으면 site를 하나 만들어 owner로 붙인다.
 * bootstrap owner 이메일(검증된)만 기존 bootstrap site를 받는다.
 */
export const ensureFirstSite = async (
  pool: pg.Pool,
  config: ApiConfig,
  input: {
    readonly userId: string;
    readonly email: string | null;
    readonly emailVerified: boolean | null;
  },
): Promise<{ readonly siteId: string; readonly created: boolean }> => {
  const existing = await pool.query<{ site_id: string }>(
    `SELECT site_id FROM memberships WHERE user_id = $1 ORDER BY site_id LIMIT 1`,
    [input.userId],
  );
  const joined = existing.rows[0];
  if (joined) {
    return { siteId: joined.site_id, created: false };
  }
  const isBootstrapOwner =
    sameEmail(input.email, config.bootstrapOwnerEmail) && input.emailVerified !== false;
  if (isBootstrapOwner) {
    await attachOwner(pool, config.bootstrapSiteId, input.userId);
    return { siteId: config.bootstrapSiteId, created: false };
  }
  const siteId = `site_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await pool.query(
    `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now())`,
    [siteId, "Home"],
  );
  await attachOwner(pool, siteId, input.userId);
  return { siteId, created: true };
};
