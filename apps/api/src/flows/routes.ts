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
  type RevisionArtifact,
} from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireCsrf } from "../auth/session.js";
import { sendToRuntime } from "../runtime/hub.js";
import { requireSiteMember } from "../sites/access.js";
import { artifactFromDraft } from "./artifact.js";
import {
  createFlow,
  getFlow,
  getRevision,
  insertDeployment,
  insertRevision,
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
    const flow = await getFlow(pool, member.siteId, flowId);
    if (!flow) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "flow not found"));
    }
    const artifact = artifactFromDraft({
      siteId: member.siteId,
      flowId,
      definition: flow.draft.definition_json as object,
      triggers: flow.draft.triggers_json as RevisionArtifact["triggers"],
      connections: flow.draft.connections_json as RevisionArtifact["connections"],
      executionPolicy: flow.draft.execution_policy_json as RevisionArtifact["executionPolicy"],
    });
    const compiled = compileDefinition(artifact.definition);
    if (!compiled.ok) {
      return reply.code(400).send(compiled);
    }
    if (
      artifact.triggers.some((item) => item.kind === "ha.state_changed") &&
      !artifact.connections.some((item) => item.kind === "ha")
    ) {
      return reply
        .code(400)
        .send(errorBody(errorCodes.invalidRequest, "HA trigger requires an HA connection"));
    }
    await insertRevision(pool, member.siteId, flowId, artifact);
    return { revisionId: artifact.revisionId, digest: artifact.artifactDigest };
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
    const flow = await getFlow(pool, member.siteId, flowId);
    if (
      parsed.data.stateEpoch === "keep" &&
      flow?.deployment?.revision_id !== parsed.data.revisionId
    ) {
      return reply
        .code(400)
        .send(errorBody(errorCodes.invalidRequest, "keep is only valid for the same revision"));
    }
    const artifact = await getRevision(pool, parsed.data.revisionId);
    if (!artifact) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "revision not found"));
    }
    const created = await insertDeployment(pool, {
      siteId: member.siteId,
      flowId,
      revisionId: parsed.data.revisionId,
    });
    const sent = sendToRuntime(member.siteId, "desired.deployment", {
      deploymentId: created.id,
      generation: created.generation,
      artifact,
      rollback: parsed.data.rollback,
      stateEpoch: parsed.data.stateEpoch ?? "reset",
    });
    if (!sent) {
      return reply.code(409).send(errorBody(errorCodes.runtimeOffline, "runtime offline"));
    }
    return reply.code(202).send({
      deploymentId: created.id,
      generation: created.generation,
    });
  });

  registerFlowRunRoutes(app, pool, gate);
};
