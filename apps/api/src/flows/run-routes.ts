/**
 * 배포 조회와 run 시작·목록.
 */
import { errorBody, errorCodes, startRunRequestSchema } from "@howling/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { presentRun } from "./present.js";
import { getRun, listRuns } from "./runs.js";
import { getFlow } from "./store.js";

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
};
