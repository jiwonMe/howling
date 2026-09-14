/**
 * HttpOnly 세션과 CSRF 쿠키.
 */
import { randomUUID } from "node:crypto";
import { errorBody, errorCodes } from "@howling/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import type { ApiConfig } from "../config.js";
import { hashToken, randomToken, sameToken } from "../crypto.js";

export const SESSION_COOKIE = "howling_session";
export const CSRF_COOKIE = "howling_csrf";
const SESSION_MS = 12 * 60 * 60 * 1000;

export interface SessionUser {
  readonly id: string;
  readonly email: string | null;
}

export const cookieOptions = (config: ApiConfig, httpOnly: boolean) => ({
  path: "/",
  httpOnly,
  sameSite: "lax" as const,
  secure: config.cookieSecure,
  maxAge: SESSION_MS / 1000,
});

export const createSession = async (
  pool: pg.Pool,
  config: ApiConfig,
  reply: FastifyReply,
  userId: string,
): Promise<void> => {
  const token = randomToken();
  const csrf = randomToken();
  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, now())`,
    [
      randomUUID(),
      userId,
      hashToken(token),
      new Date(Date.now() + SESSION_MS).toISOString(),
    ],
  );
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(config, true));
  reply.setCookie(CSRF_COOKIE, csrf, cookieOptions(config, false));
};

export const readSession = async (
  pool: pg.Pool,
  request: FastifyRequest,
): Promise<SessionUser | undefined> => {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) {
    return undefined;
  }
  const result = await pool.query<{ id: string; email: string | null }>(
    `SELECT users.id, users.email
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
    [hashToken(token)],
  );
  return result.rows[0];
};

export const requireSession = async (
  pool: pg.Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<SessionUser | undefined> => {
  const user = await readSession(pool, request);
  if (!user) {
    await reply.code(401).send(errorBody(errorCodes.unauthorized, "로그인이 필요합니다."));
    return undefined;
  }
  return user;
};

export const requireCsrf = (
  request: FastifyRequest,
  reply: FastifyReply,
): boolean => {
  const cookie = request.cookies[CSRF_COOKIE] ?? "";
  const header = String(request.headers["x-csrf-token"] ?? "");
  if (!cookie || !header || !sameToken(cookie, header)) {
    void reply.code(403).send(errorBody(errorCodes.csrfFailed, "CSRF 토큰이 올바르지 않습니다."));
    return false;
  }
  return true;
};

export const clearSession = async (
  pool: pg.Pool,
  config: ApiConfig,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const token = request.cookies[SESSION_COOKIE];
  if (token) {
    await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
      hashToken(token),
    ]);
  }
  reply.clearCookie(SESSION_COOKIE, cookieOptions(config, true));
  reply.clearCookie(CSRF_COOKIE, cookieOptions(config, false));
};
