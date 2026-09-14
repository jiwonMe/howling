/**
 * Pairing HTTP. 미인증 생성은 rate limit.
 */
import {
  errorBody,
  errorCodes,
  pairingClaimRequestSchema,
  pairingClaimResponseSchema,
  pairingCompleteResponseSchema,
  pairingCreateResponseSchema,
} from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireCsrf } from "../auth/session.js";
import { requireSiteMember } from "../sites/access.js";
import { ackPairing, claimPairing, createPairing, readPairing } from "./store.js";

const hits = new Map<string, { count: number; resetAt: number }>();

const allowCreate = (ip: string): boolean => {
  const now = Date.now();
  const current = hits.get(ip);
  if (!current || current.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 10;
};

export const registerPairingRoutes = (
  app: FastifyInstance,
  pool: pg.Pool,
): void => {
  app.post("/api/v1/runtime-pairings", async (request, reply) => {
    const ip = request.ip;
    if (!allowCreate(ip)) {
      return reply.code(429).send(errorBody(errorCodes.invalidRequest, "too many pairing attempts"));
    }
    const created = await createPairing(pool);
    return pairingCreateResponseSchema.parse(created);
  });

  app.get("/api/v1/runtime-pairings/:pairingId", async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const secret = String(request.headers["x-runtime-secret"] ?? "");
    const row = await readPairing(pool, pairingId, secret);
    if (!row) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "pairing not found"));
    }
    return pairingCompleteResponseSchema.parse(row);
  });

  app.post("/api/v1/runtime-pairings/:pairingId/ack", async (request, reply) => {
    const { pairingId } = request.params as { pairingId: string };
    const secret = String(request.headers["x-runtime-secret"] ?? "");
    const ok = await ackPairing(pool, pairingId, secret);
    if (!ok) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "pairing not found"));
    }
    return { ok: true };
  });

  app.post("/api/v1/sites/:siteId/runtime/pair", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const body = pairingClaimRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid body"));
    }
    const claimed = await claimPairing(pool, {
      siteId: member.siteId,
      code: body.data.code,
    });
    if (!claimed) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "code expired or unknown"));
    }
    return pairingClaimResponseSchema.parse(claimed);
  });
};
