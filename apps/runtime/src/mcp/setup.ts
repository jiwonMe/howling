/**
 * 로컬 setup만. Cloud API로 command를 받지 않는다.
 */
import { mcpLocalSetupSchema } from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { finishMcpOauth, pendingOauthByState, startMcpOauth } from "./oauth.js";
import type { McpRegistry } from "./registry.js";
import { writeMcpConfig } from "./secrets.js";
import { listConnections, upsertConnection } from "./store.js";

export const registerMcpSetupRoutes = (
  app: FastifyInstance,
  input: {
    readonly db: Database.Database;
    readonly secretRoot: string;
    readonly siteId: () => string;
    readonly apiHttpUrl: string;
    readonly registry: McpRegistry;
    readonly onChanged: () => void;
  },
): void => {
  app.get("/v1/setup/mcp", async () => ({
    servers: listConnections(input.db, "mcp"),
    snapshot: input.registry.snapshot(),
  }));

  app.post("/v1/setup/mcp", async (request, reply) => {
    const parsed = mcpLocalSetupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid mcp setup" });
    }
    const { token, ...config } = parsed.data;
    if (config.transport === "stdio" && !config.command) {
      return reply.code(400).send({ error: "command required" });
    }
    if (config.transport === "http" && !config.url) {
      return reply.code(400).send({ error: "url required" });
    }
    writeMcpConfig(input.secretRoot, config, token);
    upsertConnection(input.db, {
      id: config.id,
      kind: "mcp",
      name: config.name,
      status: "configured",
    });
    await input.registry.reload();
    input.onChanged();
    return { ok: true, snapshot: input.registry.snapshot() };
  });

  app.post("/v1/setup/mcp/:id/oauth/start", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      authorizeUrl?: string;
      tokenUrl?: string;
      clientId?: string;
    };
    if (!body.authorizeUrl || !body.tokenUrl || !body.clientId) {
      return reply.code(400).send({ error: "oauth urls required" });
    }
    const started = startMcpOauth(input.secretRoot, {
      connectionId: id,
      siteId: input.siteId(),
      authorizeUrl: body.authorizeUrl,
      tokenUrl: body.tokenUrl,
      clientId: body.clientId,
      redirectUri: `${input.apiHttpUrl.replace(/\/$/, "")}/api/v1/oauth/mcp/callback`,
    });
    return started;
  });

  app.post("/v1/setup/mcp/oauth/finish", async (request, reply) => {
    const body = request.body as { state?: string; code?: string };
    if (!body.state || !body.code) {
      return reply.code(400).send({ error: "state and code required" });
    }
    const ids = listConnections(input.db, "mcp").map((row) => row.id);
    const pending = pendingOauthByState(input.secretRoot, ids, body.state);
    if (!pending) {
      return reply.code(404).send({ error: "oauth pending missing" });
    }
    const ok = await finishMcpOauth(input.secretRoot, pending.connectionId, body.state, body.code);
    if (!ok) {
      return reply.code(409).send({ error: "oauth exchange failed" });
    }
    await input.registry.reload();
    input.onChanged();
    return { ok: true };
  });
};
