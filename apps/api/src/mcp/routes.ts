/**
 * POST /mcp. Bearer only. 쿠키/CSRF 없음.
 */
import { MCP_TOOL_SCOPES, errorBody, errorCodes } from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { resolveToken } from "../tokens/store.js";
import { dispatchMcpTool } from "./dispatch.js";

export const registerMcpRoutes = (app: FastifyInstance, pool: pg.Pool): void => {
  app.post("/mcp", async (request, reply) => {
    const header = request.headers.authorization ?? "";
    const raw = header.startsWith("Bearer ") ? header.slice(7) : "";
    const identity = raw ? await resolveToken(pool, raw) : undefined;
    if (!identity) {
      return reply.code(401).send(errorBody(errorCodes.unauthorized, "invalid token"));
    }
    const rpc = request.body as {
      jsonrpc?: string;
      id?: string | number;
      method?: string;
      params?: { name?: string; arguments?: Record<string, unknown> };
    };
    if (rpc.method === "notifications/initialized") {
      return reply.code(204).send();
    }
    if (rpc.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "howling", version: "0.1.0" },
        },
      };
    }
    if (rpc.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          tools: Object.keys(MCP_TOOL_SCOPES).map((name) => ({
            name,
            description: name.replaceAll("_", " "),
            inputSchema: { type: "object" },
          })),
        },
      };
    }
    if (rpc.method !== "tools/call" || !rpc.params?.name) {
      return {
        jsonrpc: "2.0",
        id: rpc.id ?? null,
        error: { code: -32601, message: "method not found" },
      };
    }
    const result = await dispatchMcpTool(
      pool,
      {
        siteId: identity.siteId,
        permissions: identity.scopes,
        ...(identity.flowId ? { flowId: identity.flowId } : {}),
      },
      rpc.params.name,
      rpc.params.arguments ?? {},
    );
    if (!result.ok) {
      return reply.code(result.status).send({
        jsonrpc: "2.0",
        id: rpc.id ?? null,
        error: {
          code: result.status,
          message: (result.body as { error?: { message?: string } })?.error?.message ?? "denied",
        },
      });
    }
    return {
      jsonrpc: "2.0",
      id: rpc.id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result.body) }],
      },
    };
  });
};
