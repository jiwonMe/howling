/**
 * site 소유권 확인.
 */
import { errorBody, errorCodes } from "@howling/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { requireSession, type SessionUser } from "../auth/session.js";

export const requireSiteMember = async (
  pool: pg.Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ user: SessionUser; siteId: string } | undefined> => {
  const user = await requireSession(pool, request, reply);
  if (!user) {
    return undefined;
  }
  const { siteId } = request.params as { siteId: string };
  const allowed = await pool.query(
    `SELECT 1 FROM memberships WHERE site_id = $1 AND user_id = $2`,
    [siteId, user.id],
  );
  if ((allowed.rowCount ?? 0) === 0) {
    await reply
      .code(403)
      .send(errorBody(errorCodes.forbidden, "이 공간에 접근할 수 없습니다."));
    return undefined;
  }
  return { user, siteId };
};
