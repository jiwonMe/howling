/**
 * Pairing 행.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import { hashToken, randomToken } from "../crypto.js";

export const PAIRING_TTL_MS = 10 * 60_000;

export const createPairing = async (pool: pg.Pool) => {
  const pairingId = randomUUID();
  const code = randomBytes(3).toString("hex").slice(0, 6);
  const runtimeSecret = randomToken();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
  await pool.query(
    `INSERT INTO runtime_pairings
       (id, code, runtime_secret_hash, status, expires_at, created_at)
     VALUES ($1, $2, $3, 'pending', $4, now())`,
    [pairingId, code, hashToken(runtimeSecret), expiresAt],
  );
  return { pairingId, code, runtimeSecret, expiresAt };
};

export const claimPairing = async (
  pool: pg.Pool,
  input: { readonly siteId: string; readonly code: string },
) => {
  const row = await pool.query<{
    id: string;
    status: string;
    expires_at: Date;
  }>(
    `SELECT id, status, expires_at FROM runtime_pairings WHERE code = $1`,
    [input.code],
  );
  const pairing = row.rows[0];
  if (!pairing || pairing.status !== "pending") {
    return undefined;
  }
  if (pairing.expires_at.getTime() < Date.now()) {
    return undefined;
  }
  const runtimeId = `rt_${randomUUID()}`;
  const token = randomToken();
  await pool.query(
    `INSERT INTO runtime_registrations
       (id, site_id, runtime_id, token_hash, connection_generation, online, created_at)
     VALUES ($1, $2, $3, $4, 0, FALSE, now())
     ON CONFLICT (site_id) DO UPDATE
       SET runtime_id = EXCLUDED.runtime_id,
           token_hash = EXCLUDED.token_hash,
           online = FALSE`,
    [randomUUID(), input.siteId, runtimeId, hashToken(token)],
  );
  await pool.query(
    `UPDATE runtime_pairings
     SET status = 'claimed', runtime_id = $2, site_id = $3,
         token_hash = $4, issued_token = $5
     WHERE id = $1`,
    [pairing.id, runtimeId, input.siteId, hashToken(token), token],
  );
  return { pairingId: pairing.id, runtimeId };
};

export const readPairing = async (
  pool: pg.Pool,
  pairingId: string,
  secret: string,
) => {
  const row = await pool.query<{
    runtime_secret_hash: string;
    status: string;
    issued_token: string | null;
    runtime_id: string | null;
    site_id: string | null;
    expires_at: Date;
  }>(`SELECT * FROM runtime_pairings WHERE id = $1`, [pairingId]);
  const pairing = row.rows[0];
  if (!pairing || pairing.runtime_secret_hash !== hashToken(secret)) {
    return undefined;
  }
  if (pairing.expires_at.getTime() < Date.now()) {
    return { status: "pending" as const };
  }
  if (pairing.status === "ready") {
    return { status: "ready" as const };
  }
  if (pairing.status === "claimed" && pairing.issued_token) {
    return {
      status: "claimed" as const,
      token: pairing.issued_token,
      runtimeId: pairing.runtime_id ?? undefined,
      siteId: pairing.site_id ?? undefined,
    };
  }
  return { status: "pending" as const };
};

export const ackPairing = async (
  pool: pg.Pool,
  pairingId: string,
  secret: string,
): Promise<boolean> => {
  const current = await readPairing(pool, pairingId, secret);
  if (!current || current.status === "pending") {
    return false;
  }
  await pool.query(
    `UPDATE runtime_pairings
     SET status = 'ready', issued_token = NULL
     WHERE id = $1`,
    [pairingId],
  );
  return true;
};
