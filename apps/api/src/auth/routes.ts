/**
 * 로그인·콜백·세션 조회·로그아웃.
 */
import { randomUUID } from "node:crypto";
import { currentUserSchema, errorBody, errorCodes } from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { ApiConfig } from "../config.js";
import {
  CSRF_COOKIE,
  clearSession,
  createSession,
  requireCsrf,
  requireSession,
} from "./session.js";
import {
  discoverOidc,
  finishOidcLogin,
  startOidcLogin,
} from "./oidc.js";
import { attachOwner, upsertUser } from "../sites/provision.js";

export const registerAuthRoutes = (
  app: FastifyInstance,
  pool: pg.Pool,
  config: ApiConfig,
): void => {
  app.get("/api/v1/auth/login", async (request, reply) => {
    const oidc = await discoverOidc(config);
    const start = await startOidcLogin(oidc, config);
    await pool.query(
      `INSERT INTO oidc_login_states (id, state, nonce, code_verifier, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        randomUUID(),
        start.state,
        start.nonce,
        start.codeVerifier,
        new Date(Date.now() + 10 * 60_000).toISOString(),
      ],
    );
    return reply.redirect(start.authorizationUrl);
  });

  app.get("/api/v1/auth/callback", async (request, reply) => {
    const url = new URL(request.url, config.oidcRedirectUri);
    const state = url.searchParams.get("state") ?? "";
    const stored = await pool.query<{
      nonce: string;
      code_verifier: string;
    }>(
      `SELECT nonce, code_verifier
       FROM oidc_login_states
       WHERE state = $1 AND expires_at > now()`,
      [state],
    );
    const row = stored.rows[0];
    if (!row) {
      return reply
        .code(400)
        .send(errorBody(errorCodes.invalidRequest, "로그인 상태가 만료되었습니다."));
    }
    await pool.query(`DELETE FROM oidc_login_states WHERE state = $1`, [state]);
    const oidc = await discoverOidc(config);
    const identity = await finishOidcLogin(oidc, {
      currentUrl: url,
      codeVerifier: row.code_verifier,
      state,
      nonce: row.nonce,
    });
    const userId = await upsertUser(pool, {
      issuer: config.oidcIssuer,
      subject: identity.subject,
      email: identity.email,
    });
    await attachOwner(pool, config.bootstrapSiteId, userId);
    await createSession(pool, config, reply, userId);
    return reply.redirect(`${config.publicOrigin}/`);
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const user = await requireSession(pool, request, reply);
    if (!user) {
      return;
    }
    return currentUserSchema.parse({
      id: user.id,
      email: user.email,
      csrfToken: request.cookies[CSRF_COOKIE] ?? "",
    });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    if (!requireCsrf(request, reply)) {
      return;
    }
    await clearSession(pool, config, request, reply);
    return { ok: true };
  });
};
