/**
 * POST /mcp. Bearer only. 쿠키/CSRF 없음.
 */
import { errorBody, errorCodes } from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { resolveToken } from "../tokens/store.js";
import { listMcpTools } from "./catalog.js";
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
        result: { tools: listMcpTools() },
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
      const detail = (result.body as { error?: { message?: string } })?.error;
      return reply.code(result.status).send({
        jsonrpc: "2.0",
        id: rpc.id ?? null,
        error: {
          code: result.status,
          message: detail?.message ?? "denied",
          // 필드 단위 issues·오류 code·컴파일 diagnostics를 그대로 싣는다.
          data: result.body,
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
