/**
 * Commit 뒤에만 dispatcher·timer·다음 step을 예약한다.
 */
import type { EffectRequest, ExecutionState, Transition } from "@howling/core";
import { getArtifact } from "../store/artifacts.js";
import type { ProgressionMode } from "../store/triggers.js";
import { nextQueuedTrigger } from "../store/triggers.js";
import type { HostContext } from "./context.js";
import { canAutoStep, isTerminalStatus } from "./status.js";

export const afterPersist = (
  ctx: HostContext,
  input: {
    readonly transition: Transition;
    readonly mode: ProgressionMode;
    readonly halted: boolean;
    readonly publish: "new" | "all";
  },
): void => {
  if (input.halted) {
    return;
  }
  const state = input.transition.state;
  if (isTerminalStatus(state.status)) {
    startNextQueued(ctx, state.workflowId);
    return;
  }
  const requests =
    input.publish === "all"
      ? requestedEffects(state)
      : input.transition.effects;
  scheduleRequests(ctx, state, requests);
  if (canAutoStep(state, input.mode)) {
    void ctx.inbox.enqueue({ kind: "step", runId: state.runId });
  }
};

export const startNextQueued = (ctx: HostContext, flowId: string): void => {
  const next = nextQueuedTrigger(ctx.db, flowId, new Date(ctx.now()).toISOString());
  if (!next) {
    return;
  }
  const artifact = getArtifact(ctx.db, next.artifactId);
  if (!artifact) {
    return;
  }
  void ctx.inbox.enqueue({
    kind: "start_run",
    triggerId: next.id,
    artifactId: next.artifactId,
    input: next.input,
    mode: next.mode,
    idempotencyKey: next.idempotencyKey,
  });
};

const requestedEffects = (state: ExecutionState): EffectRequest[] =>
  Object.values(state.effects)
    .filter((record) => record.status === "requested")
    .map((record) => ({
      id: record.id,
      runId: record.runId,
      nodeId: record.nodeId,
      index: record.index,
      intent: record.intent,
    }));

const scheduleRequests = (
  ctx: HostContext,
  state: ExecutionState,
  requests: readonly EffectRequest[],
): void => {
  for (const request of requests) {
    const record = state.effects[request.id];
    if (!record || record.status !== "requested") {
      continue;
    }
    if (record.intent.kind === "timer") {
      ctx.timers.schedule(record);
      continue;
    }
    if (!state.paused && !state.cancelled) {
      void ctx.inbox.enqueue({
        kind: "dispatch",
        runId: state.runId,
        effectId: record.id,
      });
    }
  }
};
