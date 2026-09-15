/**
 * OAuth code를 runtime에 한 번만 넘긴다. 저장·로그하지 않는다.
 */
import { errorBody, errorCodes } from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import { sendToRuntime } from "../runtime/hub.js";

export const registerMcpOauthRoutes = (app: FastifyInstance): void => {
  app.get("/api/v1/oauth/mcp/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    if (!query.code || !query.state) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "code and state required"));
    }
    const siteId = query.state.split(".")[0];
    if (!siteId) {
      return reply.code(400).send(errorBody(errorCodes.invalidRequest, "invalid state"));
    }
    const sent = sendToRuntime(siteId, "oauth.code", {
      state: query.state,
      code: query.code,
    });
    if (!sent) {
      return reply.code(409).send(errorBody(errorCodes.runtimeOffline, "runtime offline"));
    }
    return reply.type("text/html").send("<!doctype html><p>MCP 연결을 마쳤습니다. 이 창을 닫아도 됩니다.</p>");
  });
};
