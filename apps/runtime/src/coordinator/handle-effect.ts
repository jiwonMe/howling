/**
 * effect.dispatchStarted 전달과 core command 반영.
 */
import type { EffectRequest, EffectResponse } from "@howling/core";
import { decideCommand } from "../store/events.js";
import { getOutbox } from "../store/outbox.js";
import { deletePending, savePending } from "../store/pending.js";
import { restoreRun } from "./compile.js";
import { commitTransition } from "./commit.js";
import type { HostContext } from "./context.js";
import { HostError } from "./errors.js";
import { afterPersist } from "./follow-up.js";
import { requireRun } from "./require-run.js";
import type { InboxMessage } from "./types.js";

export const handleCoreCommand = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "core_command" }>,
): unknown => {
  const decided = decideCommand(ctx.db, message.command.commandId, message.command);
  if (decided.decision === "duplicate") {
    deletePending(ctx.db, message.command.commandId);
    return { ok: true, duplicate: true };
  }
  if (decided.decision === "conflict") {
    throw new HostError("CONFLICT", "commandId already used with a different payload");
  }
  const run = requireRun(ctx, message.runId);
  const restored = restoreRun(ctx, run);
  const result = ctx.engine.applyCommand(restored.plan, restored.state, message.command);
  if (!result.ok) {
    throw new HostError(
      "INVALID",
      result.diagnostics.map((item) => item.message).join("; "),
    );
  }
  const halted = commitTransition(ctx, {
    runId: run.runId,
    flowId: run.flowId,
    artifactId: run.artifactId,
    revision: restored.state.revision,
    stateEpoch: run.stateEpoch,
    progressionMode: run.progressionMode,
    transition: result.transition,
    command: message.command,
  });
  deletePending(ctx.db, message.command.commandId);
  afterPersist(ctx, {
    transition: result.transition,
    mode: run.progressionMode,
    halted,
    publish: "new",
  });
  return { ok: true, duplicate: false };
};

export const handleDispatch = async (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "dispatch" }>,
): Promise<unknown> => {
  const run = requireRun(ctx, message.runId);
  if (run.runMode === "dryRun") {
    return { skipped: true };
  }
  const restored = restoreRun(ctx, run);
  if (restored.state.paused || restored.state.cancelled) {
    return { skipped: true };
  }
  const outbox = getOutbox(ctx.db, message.effectId);
  if (!outbox || outbox.status !== "requested") {
    return { skipped: true };
  }
  const started = ctx.engine.applyCommand(restored.plan, restored.state, {
    type: "effect.dispatchStarted",
    commandId: `dispatch:${message.effectId}`,
    effectId: message.effectId,
  });
  if (!started.ok) {
    throw new HostError(
      "INVALID",
      started.diagnostics.map((item) => item.message).join("; "),
    );
  }
  const halted = commitTransition(ctx, {
    runId: run.runId,
    flowId: run.flowId,
    artifactId: run.artifactId,
    revision: restored.state.revision,
    stateEpoch: run.stateEpoch,
    progressionMode: run.progressionMode,
    transition: started.transition,
    command: {
      type: "effect.dispatchStarted",
      commandId: `dispatch:${message.effectId}`,
      effectId: message.effectId,
    },
  });
  if (halted) {
    return { halted: true };
  }
  const record = started.transition.state.effects[message.effectId];
  if (!record) {
    return { skipped: true };
  }
  const request: EffectRequest = {
    id: record.id,
    runId: record.runId,
    nodeId: record.nodeId,
    index: record.index,
    intent: record.intent,
  };
  const result = await ctx.adapter.execute(request);
  if ("kind" in result && result.kind === "hang") {
    await new Promise(() => undefined);
  }
  if ("kind" in result) {
    return { crashed: result.kind === "crash" };
  }
  enqueueResolved(ctx, message.runId, message.effectId, result);
  return { dispatched: true };
};

const enqueueResolved = (
  ctx: HostContext,
  runId: string,
  effectId: string,
  response: EffectResponse,
): void => {
  const commandId = `resolve:${effectId}`;
  const message: InboxMessage = {
    kind: "core_command",
    runId,
    command: {
      type: "effect.resolved",
      commandId,
      effectId,
      response,
    },
  };
  savePending(ctx.db, commandId, message);
  void ctx.inbox.enqueue(message);
};
