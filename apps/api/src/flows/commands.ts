/**
 * Run command를 runtime WSS로만 중계한다. 오프라인 queue는 없다.
 */
import { errorBody, errorCodes, type RunCommandRequest } from "@howling/contracts";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { getRun } from "./runs.js";

const COMMAND_TTL_MS = 30_000;

export const relayRunCommand = async (
  pool: pg.Pool,
  siteId: string,
  runId: string,
  command: RunCommandRequest,
): Promise<{ status: number; body: unknown }> => {
  const run = await getRun(pool, siteId, runId);
  if (!run) {
    return { status: 404, body: errorBody(errorCodes.notFound, "run not found") };
  }
  if (command.type === "fixture" && (!command.effectId || !command.response)) {
    return { status: 400, body: errorBody(errorCodes.invalidRequest, "fixture requires effectId") };
  }
  const expiresAt = new Date(Date.now() + COMMAND_TTL_MS).toISOString();
  const sent = sendToRuntime(siteId, "run.step", {
    runId,
    type: command.type,
    commandId: command.commandId,
    effectId: command.effectId,
    response: command.response,
    expiresAt,
  });
  if (!sent) {
    return { status: 409, body: errorBody(errorCodes.runtimeOffline, "runtime offline") };
  }
  return { status: 202, body: { accepted: true, expiresAt } };
};
