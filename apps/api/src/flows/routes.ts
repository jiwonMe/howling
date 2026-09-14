/**
 * Site 아래 flow·catalog·run route.
 */
import { randomUUID } from "node:crypto";
import {
  NODE_CATALOG_VERSION,
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
import { artifactDigest } from "./digest.js";
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
    const definition = {
      ...(flow.draft.definition_json as object),
      id: flowId,
      revision: "pending",
    };
    const compiled = compileDefinition(definition);
    if (!compiled.ok) {
      return reply.code(400).send(compiled);
    }
    const revisionId = randomUUID();
    const definitionWithId = {
      ...definition,
      revision: revisionId,
    } as RevisionArtifact["definition"];
    const triggers = flow.draft.triggers_json as RevisionArtifact["triggers"];
    const connections = flow.draft.connections_json as RevisionArtifact["connections"];
    const executionPolicy = flow.draft
      .execution_policy_json as RevisionArtifact["executionPolicy"];
    if (
      Array.isArray(triggers) &&
      triggers.some((item) => item.kind === "ha.state_changed") &&
      !(Array.isArray(connections) && connections.some((item) => item.kind === "ha"))
    ) {
      return reply
        .code(400)
        .send(errorBody(errorCodes.invalidRequest, "HA trigger requires an HA connection"));
    }
    const requirements = {
      protocolVersion: 1 as const,
      nodeCatalogVersion: NODE_CATALOG_VERSION,
      connectors: ["homeassistant"] as const,
    };
    const digest = artifactDigest({
      definition: { ...definitionWithId, revision: "" },
      triggers,
      connections,
      executionPolicy,
      requirements,
    });
    const artifact: RevisionArtifact = {
      schemaVersion: 1,
      siteId: member.siteId,
      flowId,
      revisionId,
      definition: definitionWithId,
      triggers,
      connections,
      requirements,
      executionPolicy,
      artifactDigest: digest,
    };
    await insertRevision(pool, member.siteId, flowId, artifact);
    return { revisionId, digest };
  });

  app.post("/api/v1/sites/:siteId/flows/:flowId/deployments", async (request, reply) => {
    const member = await gate(request, reply, true);
    if (!member) {
      return;
    }
    const { flowId } = request.params as { flowId: string };
    const body = request.body as { revisionId?: string };
    if (!body.revisionId) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "revisionId required"));
    }
    const artifact = await getRevision(pool, body.revisionId);
    if (!artifact) {
      return reply.code(404).send(errorBody(errorCodes.notFound, "revision not found"));
    }
    const created = await insertDeployment(pool, {
      siteId: member.siteId,
      flowId,
      revisionId: body.revisionId,
    });
    const sent = sendToRuntime(member.siteId, "desired.deployment", {
      deploymentId: created.id,
      generation: created.generation,
      artifact,
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
