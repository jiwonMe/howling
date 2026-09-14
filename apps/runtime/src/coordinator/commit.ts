/**
 * 전이 저장 후 halt 여부를 돌려준다.
 */
import type { EngineCommand, Transition } from "@howling/core";
import { sha256Json } from "../store/hash.js";
import { persistTransition } from "./persist.js";
import type { HostContext } from "./context.js";
import type { ProgressionMode } from "../store/triggers.js";

export const commitTransition = (
  ctx: HostContext,
  input: {
    readonly runId: string;
    readonly flowId: string;
    readonly artifactId: string;
    readonly revision: string;
    readonly stateEpoch: string;
    readonly progressionMode: ProgressionMode;
    readonly transition: Transition;
    readonly command?: EngineCommand | { readonly commandId: string; readonly payload: unknown };
  },
): boolean => {
  const command = input.command
    ? {
        commandId: input.command.commandId,
        digest: sha256Json(
          "type" in input.command ? input.command : input.command.payload,
        ),
        payload: "type" in input.command ? input.command : input.command.payload,
      }
    : undefined;
  persistTransition(ctx.db, ctx.engine, {
    runId: input.runId,
    flowId: input.flowId,
    artifactId: input.artifactId,
    revision: input.revision,
    stateEpoch: input.stateEpoch,
    progressionMode: input.progressionMode,
    transition: input.transition,
    ...(command ? { command } : {}),
  });
  return ctx.afterCommit({
    runId: input.runId,
    transition: input.transition,
  }) === "halt";
};
