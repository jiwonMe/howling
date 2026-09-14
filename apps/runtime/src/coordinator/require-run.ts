/**
 * 저장된 run을 읽고 없으면 실패한다.
 */
import { getRun, type RunRow } from "../store/runs.js";
import type { HostContext } from "./context.js";
import { HostError } from "./errors.js";

export const requireRun = (ctx: HostContext, runId: string): RunRow => {
  const run = getRun(ctx.db, runId);
  if (!run) {
    throw new HostError("NOT_FOUND", `run ${runId} not found`);
  }
  return run;
};
