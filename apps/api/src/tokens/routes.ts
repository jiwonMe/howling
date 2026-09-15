/**
 * Owner가 scoped token을 발급·폐기한다. 원문은 한 번만.
 */
import {
  errorBody,
  errorCodes,
  issueTokenRequestSchema,
} from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireCsrf } from "../auth/session.js";
import { requireSiteMember } from "../sites/access.js";
import { issueToken, listTokens, revokeToken } from "./store.js";

export const registerTokenRoutes = (app: FastifyInstance, pool: pg.Pool): void => {
  app.get("/api/v1/sites/:siteId/tokens", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member) {
      return;
    }
    return { tokens: await listTokens(pool, member.siteId) };
  });

  app.post("/api/v1/sites/:siteId/tokens", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const parsed = issueTokenRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid token"));
    }
    const issued = await issueToken(pool, {
      siteId: member.siteId,
      userId: member.user.id,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      ...(parsed.data.flowId ? { flowId: parsed.data.flowId } : {}),
    });
    return reply.code(201).send(issued);
  });

  app.delete("/api/v1/sites/:siteId/tokens/:tokenId", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const { tokenId } = request.params as { tokenId: string };
    const ok = await revokeToken(pool, member.siteId, tokenId);
    if (!ok) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "token not found"));
    }
    return { ok: true };
  });
};
