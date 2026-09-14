/**
 * RUNTIME_TEST_HOOKS용 조회.
 */
import type { FastifyInstance } from "fastify";
import type { HaCallLog } from "../ha/hooks.js";

export const registerHookRoutes = (
  app: FastifyInstance,
  log: HaCallLog,
): void => {
  app.get("/v1/test/hooks", async () => ({
    haServiceCalls: log.calls.length,
    requestIds: log.calls.map((item) => item.id),
  }));
};
