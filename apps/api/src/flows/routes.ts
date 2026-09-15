/**
 * Site 아래 flow·catalog·run route.
 */
import {
  NODE_CATALOG_VERSION,
  deployRequestSchema,
  draftSaveSchema,
  editorSaveSchema,
  errorBody,
  errorCodes,
  officialCatalog,
  ownerPermissions,
} from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireCsrf } from "../auth/session.js";
import { requireSiteMember } from "../sites/access.js";
import { createRevision } from "./create-revision.js";
import { deactivateFlow } from "./deactivate.js";
import { deleteFlow } from "./delete.js";
import { deployRevision } from "./deploy-revision.js";
import {
  createFlow,
  getFlow,
  listFlows,
  saveDraft,
  saveEditor,
} from "./store.js";
import { presentFlow } from "./present.js";
import { registerFlowRunRoutes } from "./run-routes.js";
import { compileDefinition } from "./validate.js";
import { writeResult } from "./write.js";

export const registerFlowRoutes = (
  app: FastifyInstance,
  pool: pg.Pool,
): void => {
  const gate = async (
    request: Parameters<typeof requireSiteMember>[1],
    reply: Parameters<typeof requireSiteMember>[2],
    write = false,
  ) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member) {
      return undefined;
    }
    if (write && !requireCsrf(request, reply)) {
      return undefined;
    }
    return member;
  };

  app.get("/api/v1/sites/:siteId/catalog", async (request, reply) => {
    if (!(await gate(request, reply))) {
      return;
    }
    return { version: NODE_CATALOG_VERSION, nodes: officialCatalog };
  });

  app.get("/api/v1/sites/:siteId/connections", async (request, reply) => {
    const member = await gate(request, reply);
    if (!member) {
      return;
    }
    const runtime = await pool.query(
      `SELECT capabilities FROM runtime_registrations WHERE site_id = $1`,
      [member.siteId],
    );
    return { connections: runtime.rows[0]?.capabilities ?? { connectors: [] } };
  });

  app.get("/api/v1/sites/:siteId/flows", async (request, reply) => {
    const member = await gate(request, reply);
    if (!member) {
      return;
    }
    return { flows: await listFlows(pool, member.siteId) };
  });

  app.post("/api/v1/sites/:siteId/flows", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const body = request.body as { name?: string };
    const id = await createFlow(pool, member.siteId, body.name ?? "Untitled");
    return { flowId: id };
  });

  app.get("/api/v1/sites/:siteId/flows/:flowId", async (request, reply) => {
    const member = await gate(request, reply);
    if (!member) {
      return;
    }
    const { flowId } = request.params as { flowId: string };
    const row = await getFlow(pool, member.siteId, flowId);
    if (!row) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "flow not found"));
    }
    return presentFlow(row);
  });

  app.put("/api/v1/sites/:siteId/flows/:flowId/draft", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const parsed = draftSaveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid draft"));
    }
    const { flowId } = request.params as { flowId: string };
    const result = await saveDraft(pool, {
      siteId: member.siteId,
      flowId,
      expectedVersion: parsed.data.expectedVersion,
      definition: parsed.data.definition,
      triggers: parsed.data.triggers,
      connections: parsed.data.connections,
      executionPolicy: parsed.data.executionPolicy ?? { mode: "live", captureRaw: false },
    });
    return writeResult(reply, result);
  });

  app.put("/api/v1/sites/:siteId/flows/:flowId/editor", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const parsed = editorSaveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid editor"));
    }
    const { flowId } = request.params as { flowId: string };
    return writeResult(
      reply,
      await saveEditor(pool, {
        flowId,
        expectedVersion: parsed.data.expectedVersion,
        positions: parsed.data.positions,
        groups: parsed.data.groups ?? [],
        viewport: parsed.data.viewport,
      }),
    );
  });

  app.post("/api/v1/sites/:siteId/flows/:flowId/validate", async (request, reply) => {
    if (!(await gate(request, reply, true))) {
      return;
    }
    const body = request.body as { definition?: unknown };
    return compileDefinition(body.definition);
  });

  app.post("/api/v1/sites/:siteId/flows/:flowId/revisions", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const { flowId } = request.params as { flowId: string };
    const result = await createRevision(
      pool,
      { siteId: member.siteId, permissions: ownerPermissions },
      flowId,
    );
    return reply.code(result.status).send(result.body);
  });

  app.post("/api/v1/sites/:siteId/flows/:flowId/deployments", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const { flowId } = request.params as { flowId: string };
    const parsed = deployRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "revisionId required"));
    }
    const result = await deployRevision(
      pool,
      { siteId: member.siteId, permissions: ownerPermissions },
      flowId,
      parsed.data,
    );
    return reply.code(result.status).send(result.body);
  });

  app.post("/api/v1/sites/:siteId/flows/:flowId/deactivate", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const { flowId } = request.params as { flowId: string };
    const result = await deactivateFlow(
      pool,
      { siteId: member.siteId, permissions: ownerPermissions },
      flowId,
    );
    return reply.code(result.status).send(result.body);
  });

  app.delete("/api/v1/sites/:siteId/flows/:flowId", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const { flowId } = request.params as { flowId: string };
    const result = await deleteFlow(
      pool,
      { siteId: member.siteId, permissions: ownerPermissions },
      flowId,
    );
    return reply.code(result.status).send(result.body);
  });

  registerFlowRunRoutes(app, pool, gate);
};
