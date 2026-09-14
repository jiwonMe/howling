/**
 * 배포 조회와 run 시작·시험·SSE.
 */
import {
  errorBody,
  errorCodes,
  runCommandRequestSchema,
  startRunRequestSchema,
  testSessionRequestSchema,
} from "@howling/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { runtimeIdBySite, sendToRuntime } from "../runtime/hub.js";
import { relayRunCommand } from "./commands.js";
import { readRunEvents, sendEventStream } from "./events.js";
import { presentRun } from "./present.js";
import { getRun, listRuns } from "./runs.js";
import { getFlow } from "./store.js";
import { startTestSession } from "./test-session.js";

type Gate = (
  request: FastifyRequest,
  reply: FastifyReply,
  write?: boolean,
) => Promise<{ siteId: string } | undefined>;

export const registerFlowRunRoutes = (
  app: FastifyInstance,
  pool: pg.Pool,
  gate: Gate,
): void => {
  app.get("/api/v1/sites/:siteId/deployments/:deploymentId", async (request, reply) => {
    const member = await gate(request, reply);
    if (!member) {
      return;
    }
    const { deploymentId } = request.params as { deploymentId: string };
    const row = await pool.query(`SELECT * FROM deployments WHERE id = $1 AND site_id = $2`, [
      deploymentId,
      member.siteId,
    ]);
    if (!row.rows[0]) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "deployment not found"));
    }
    return row.rows[0];
  });

  app.post("/api/v1/sites/:siteId/flows/:flowId/runs", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const parsed = startRunRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid run"));
    }
    const { flowId } = request.params as { flowId: string };
    const flow = await getFlow(pool, member.siteId, flowId);
    const revisionId = flow?.deployment?.revision_id;
    if (!revisionId || flow?.deployment?.status !== "active") {
      return reply.code(409).send(errorBody(errorCodes.invalidRequest, "no active deployment"));
    }
    const sent = sendToRuntime(member.siteId, "run.start", {
      artifactId: revisionId,
      flowId,
      input: parsed.data.input,
      mode: parsed.data.mode,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    if (!sent) {
      return reply.code(409).send(errorBody(errorCodes.runtimeOffline, "runtime offline"));
    }
    return reply.code(202).send({ accepted: true });
  });

  app.post("/api/v1/sites/:siteId/flows/:flowId/test-sessions", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const parsed = testSessionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid test session"));
    }
    const { flowId } = request.params as { flowId: string };
    const result = await startTestSession(pool, member.siteId, flowId, parsed.data);
    return reply.code(result.status).send(result.body);
  });

  app.post("/api/v1/sites/:siteId/runs/:runId/commands", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const parsed = runCommandRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid command"));
    }
    const { runId } = request.params as { runId: string };
    const result = await relayRunCommand(pool, member.siteId, runId, parsed.data);
    return reply.code(result.status).send(result.body);
  });

  app.get("/api/v1/sites/:siteId/runs", async (request, reply) => {
    const member = await gate(request, reply);
    if (!member) {
      return;
    }
    const flowId = (request.query as { flowId?: string }).flowId;
    const rows = await listRuns(pool, member.siteId, flowId);
    return { runs: rows.map(presentRun) };
  });

  app.get("/api/v1/sites/:siteId/runs/:runId", async (request, reply) => {
    const member = await gate(request, reply);
    if (!member) {
      return;
    }
    const { runId } = request.params as { runId: string };
    const row = await getRun(pool, member.siteId, runId);
    if (!row) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "run not found"));
    }
    return presentRun(row);
  });

  app.get("/api/v1/sites/:siteId/runs/:runId/events", async (request, reply) => {
    const member = await gate(request, reply);
    if (!member) {
      return;
    }
    const { runId } = request.params as { runId: string };
    const query = request.query as { after?: string };
    const afterHeader = request.headers["last-event-id"];
    const after = Number(query.after ?? (typeof afterHeader === "string" ? afterHeader : "0"));
    const runtimeId = runtimeIdBySite(member.siteId);
    if (request.headers.accept?.includes("text/event-stream")) {
      await sendEventStream(request, reply, pool, member.siteId, runId, after, runtimeId);
      return;
    }
    const body = await readRunEvents(pool, member.siteId, runId, after, runtimeId);
    if (!body) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "run not found"));
    }
    if (body.resync) {
      return reply.code(409).send(errorBody(errorCodes.resyncRequired, "cursor is outside retention"));
    }
    return {
      ...body.snapshot,
      cursor: body.items.at(-1)?.syncSeq ?? after,
      journal: body.items.map((item) => ({ syncSeq: item.syncSeq, item: item.item })),
    };
  });
};
