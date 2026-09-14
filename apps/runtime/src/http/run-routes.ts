/**
 * 로컬 run HTTP. 클라우드 API path를 복제하지 않는다.
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { HostError } from "../coordinator/errors.js";
import type { RuntimeHost } from "../coordinator/host.js";
import type { StartRunResult } from "../coordinator/types.js";
import { readRunEvents, readRunView } from "./run-view.js";

const COMMANDS = new Set(["step", "continue", "pause", "resume", "cancel"]);

export const registerRunRoutes = (
  app: FastifyInstance,
  host: RuntimeHost,
): void => {
  app.post("/v1/runs", async (request, reply) => {
    const body = request.body as {
      artifactId?: string;
      input?: unknown;
      mode?: string;
      idempotencyKey?: string;
    };
    if (
      typeof body.artifactId !== "string" ||
      typeof body.idempotencyKey !== "string" ||
      (body.mode !== "auto" && body.mode !== "manual")
    ) {
      return reply.code(400).send({ error: "invalid body" });
    }
    try {
      const result = (await host.enqueue({
        kind: "start_run",
        triggerId: randomUUID(),
        artifactId: body.artifactId,
        input: (body.input ?? null) as never,
        mode: body.mode,
        idempotencyKey: body.idempotencyKey,
      })) as StartRunResult;
      await host.waitIdle();
      return result;
    } catch (error) {
      return sendHostError(reply, error);
    }
  });

  app.get("/v1/runs/:runId", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const view = readRunView(host.db, runId);
    if (!view) {
      return reply.code(404).send({ error: "run not found" });
    }
    return view;
  });

  app.get("/v1/runs/:runId/events", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const events = readRunEvents(host.db, runId);
    if (!events) {
      return reply.code(404).send({ error: "run not found" });
    }
    return { events };
  });

  app.post("/v1/runs/:runId/commands", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const body = request.body as { type?: string; commandId?: string };
    if (typeof body.commandId !== "string" || !COMMANDS.has(body.type ?? "")) {
      return reply.code(400).send({ error: "invalid body" });
    }
    try {
      const result = await host.enqueue({
        kind: body.type as "step" | "continue" | "pause" | "resume" | "cancel",
        runId,
        commandId: body.commandId,
      });
      await host.waitIdle();
      return result;
    } catch (error) {
      return sendHostError(reply, error);
    }
  });
};

const sendHostError = (
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  error: unknown,
): unknown => {
  if (error instanceof HostError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "CONFLICT"
          ? 409
          : error.code === "QUEUE_FULL"
            ? 429
            : error.code === "INVALID"
              ? 400
              : 500;
    return reply.code(status).send({ error: error.message, code: error.code });
  }
  throw error;
};
