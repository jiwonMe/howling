/**
 * 테스트 MCP HTTP + OAuth. 원문을 클라우드에 올리지 않는다.
 */
import Fastify from "fastify";
import { createToolState, toolList } from "./tools.js";

const listenHost = process.env.MCP_HOST ?? "0.0.0.0";
const listenPort = Number(process.env.MCP_PORT ?? "8091");
const staticToken = process.env.MCP_TOKEN ?? "test-mcp-token";
const oauthToken = process.env.MCP_OAUTH_TOKEN ?? "mcp-oauth-token";
const tools = createToolState();

const app = Fastify({ logger: false });

const authorized = (header?: string): boolean => {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return token === staticToken || token === oauthToken;
};

app.get("/health", async () => ({ status: "ok", service: "mcp-test" }));
app.get("/hooks", async () => tools.snapshot());
app.post("/hooks/reset", async () => {
  tools.reset();
  return { ok: true };
});

app.get("/oauth/authorize", async (request, reply) => {
  const query = request.query as { redirect_uri?: string; state?: string };
  if (!query.redirect_uri) {
    return reply.code(400).send({ error: "redirect_uri required" });
  }
  const target = new URL(query.redirect_uri);
  target.searchParams.set("code", "test-oauth-code");
  if (query.state) {
    target.searchParams.set("state", query.state);
  }
  return reply.redirect(target.toString());
});

app.post("/oauth/token", async (request, reply) => {
  const body = request.body as { code?: string; code_verifier?: string };
  if (body.code !== "test-oauth-code" || !body.code_verifier) {
    return reply.code(400).send({ error: "invalid grant" });
  }
  return { access_token: oauthToken, token_type: "bearer" };
});

app.post("/mcp", async (request, reply) => {
  if (!authorized(request.headers.authorization)) {
    return reply.code(401).send({ error: "unauthorized" });
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
        serverInfo: { name: "howling-mcp-test", version: "0.1.0" },
      },
    };
  }
  if (rpc.method === "tools/list") {
    return { jsonrpc: "2.0", id: rpc.id, result: { tools: toolList } };
  }
  if (rpc.method === "tools/call" && rpc.params?.name) {
    const result = tools.invoke(rpc.params.name, rpc.params.arguments ?? {});
    return { jsonrpc: "2.0", id: rpc.id, result };
  }
  return {
    jsonrpc: "2.0",
    id: rpc.id ?? null,
    error: { code: -32601, message: "method not found" },
  };
});

await app.listen({ host: listenHost, port: listenPort });
