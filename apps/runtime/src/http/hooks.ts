/**
 * RUNTIME_TEST_HOOKS용 조회와 gateway hold.
 */
import type { FastifyInstance } from "fastify";
import type { GatewayHandle } from "../gateway/client.js";
import type { HaCallLog } from "../ha/hooks.js";
import type { AdapterCall } from "../effects/fake-adapter.js";

export const registerHookRoutes = (
  app: FastifyInstance,
  log: HaCallLog,
  gateway?: GatewayHandle,
  adapterCalls?: AdapterCall[],
): void => {
  app.get("/v1/test/hooks", async () => ({
    haServiceCalls: log.calls.length,
    mcpCalls: (adapterCalls ?? []).filter((item) => item.adapter === "mcp").length,
    requestIds: log.calls.map((item) => item.id),
  }));
  app.post("/v1/test/gateway", async (request, reply) => {
    const body = request.body as { action?: string };
    if (body.action === "hold") {
      gateway?.hold();
      return { ok: true, held: true };
    }
    if (body.action === "release") {
      gateway?.release();
      return { ok: true, held: false };
    }
    return reply.code(400).send({ error: "invalid action" });
  });
};
