/**
 * 보관 정책·관측 필드·차트·원본 상세.
 */
import {
  detailRequestBodySchema,
  errorBody,
  errorCodes,
  observationSpecSchema,
  ownerPermissions,
  siteDataPolicySchema,
} from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireCsrf } from "../auth/session.js";
import { requireSiteMember } from "../sites/access.js";
import { runtimeIdBySite } from "../runtime/hub.js";
import { getAnalyticsFor } from "./analytics.js";
import { requestRunDetail } from "./detail.js";
import { pushDesiredData } from "./push.js";
import { getDataPolicy, getObservations, lastSyncAt, putDataPolicy, putObservations } from "./store.js";
import { retainCloud } from "./retain.js";

export const registerDataRoutes = (app: FastifyInstance, pool: pg.Pool): void => {
  const actorOf = (siteId: string) => ({ siteId, permissions: ownerPermissions });

  app.get("/api/v1/sites/:siteId/data-policy", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member) {
      return;
    }
    const runtimeId = runtimeIdBySite(member.siteId);
    return {
      policy: await getDataPolicy(pool, member.siteId),
      lastSyncAt: runtimeId ? await lastSyncAt(pool, runtimeId) : null,
    };
  });

  app.put("/api/v1/sites/:siteId/data-policy", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const parsed = siteDataPolicySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid policy"));
    }
    const policy = await putDataPolicy(pool, member.siteId, parsed.data);
    await pushDesiredData(pool, member.siteId);
    return { policy };
  });

  app.post("/api/v1/sites/:siteId/data-policy/purge", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const removed = await retainCloud(pool, member.siteId, true);
    return { ok: true, removed };
  });

  app.get("/api/v1/sites/:siteId/observations", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member) {
      return;
    }
    return { observations: await getObservations(pool, member.siteId) };
  });

  app.put("/api/v1/sites/:siteId/observations", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const parsed = observationSpecSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid observations"));
    }
    const observations = await putObservations(pool, member.siteId, parsed.data);
    await pushDesiredData(pool, member.siteId);
    return { observations };
  });

  app.get("/api/v1/sites/:siteId/analytics", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member) {
      return;
    }
    const after = Number((request.query as { after?: string }).after ?? 0);
    const result = await getAnalyticsFor(pool, actorOf(member.siteId), after);
    return reply.code(result.status).send(result.body);
  });

  app.post("/api/v1/sites/:siteId/runs/:runId/detail-requests", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const parsed = detailRequestBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid detail"));
    }
    const { runId } = request.params as { runId: string };
    const result = await requestRunDetail(pool, actorOf(member.siteId), runId, {
      ...(parsed.data.nodeId ? { nodeId: parsed.data.nodeId } : {}),
      ...(parsed.data.field ? { field: parsed.data.field } : {}),
      ...(parsed.data.sequence !== undefined ? { sequence: parsed.data.sequence } : {}),
    });
    return reply.code(result.status).send(result.body);
  });
};
