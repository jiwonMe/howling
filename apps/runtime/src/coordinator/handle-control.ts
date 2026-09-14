/**
 * 제품 step/continue/pause/resume/cancel.
 */
import type {
  CompiledWorkflow,
  EngineCommand,
  ExecutionState,
  TransitionResult,
} from "@howling/core";
import { decideCommand } from "../store/events.js";
import { restoreRun } from "./compile.js";
import { commitTransition } from "./commit.js";
import type { HostContext } from "./context.js";
import { HostError } from "./errors.js";
import { afterPersist } from "./follow-up.js";
import { requireRun } from "./require-run.js";
import type { InboxMessage } from "./types.js";

export const handleStep = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "step" }>,
): unknown => applyProduct(ctx, message.runId, message.commandId, "step", (plan, state) =>
  ctx.engine.step(plan, state),
);

export const handleContinue = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "continue" }>,
): unknown =>
  applyProduct(ctx, message.runId, message.commandId, "continue", (plan, state) =>
    ctx.engine.step(plan, state),
    "auto",
  );

export const handlePause = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "pause" }>,
): unknown =>
  applyCoreControl(ctx, message.runId, message.commandId, {
    type: "run.pause",
    commandId: message.commandId,
  });

export const handleResume = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "resume" }>,
): unknown =>
  applyCoreControl(ctx, message.runId, message.commandId, {
    type: "run.resume",
    commandId: message.commandId,
  }, "all");

export const handleCancel = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "cancel" }>,
): unknown =>
  applyCoreControl(ctx, message.runId, message.commandId, {
    type: "run.cancel",
    commandId: message.commandId,
  });

const applyProduct = (
  ctx: HostContext,
  runId: string,
  commandId: string | undefined,
  kind: "step" | "continue",
  apply: (
    plan: CompiledWorkflow,
    state: ExecutionState,
  ) => TransitionResult,
  modeOverride?: "auto",
): unknown => {
  if (commandId) {
    const decided = decideCommand(ctx.db, commandId, { kind, runId });
    if (decided.decision === "duplicate") {
      return { ok: true, duplicate: true };
    }
    if (decided.decision === "conflict") {
      throw new HostError("CONFLICT", "commandId already used with a different payload");
    }
  }
  const run = requireRun(ctx, runId);
  const restored = restoreRun(ctx, run);
  const result = apply(restored.plan, restored.state);
  if (!result.ok) {
    throw new HostError(
      "INVALID",
      result.diagnostics.map((item) => item.message).join("; "),
    );
  }
  const mode = modeOverride ?? run.progressionMode;
  const halted = commitTransition(ctx, {
    runId,
    flowId: run.flowId,
    artifactId: run.artifactId,
    revision: restored.state.revision,
    stateEpoch: run.stateEpoch,
    progressionMode: mode,
    transition: result.transition,
    ...(commandId ? { command: { commandId, payload: { kind, runId } } } : {}),
  });
  afterPersist(ctx, {
    transition: result.transition,
    mode,
    halted,
    publish: "new",
  });
  return { ok: true, duplicate: false };
};

const applyCoreControl = (
  ctx: HostContext,
  runId: string,
  commandId: string,
  command: EngineCommand,
  publish: "new" | "all" = "new",
): unknown => {
  const decided = decideCommand(ctx.db, commandId, command);
  if (decided.decision === "duplicate") {
    return { ok: true, duplicate: true };
  }
  if (decided.decision === "conflict") {
    throw new HostError("CONFLICT", "commandId already used with a different payload");
  }
  const run = requireRun(ctx, runId);
  const restored = restoreRun(ctx, run);
  const result = ctx.engine.applyCommand(restored.plan, restored.state, command);
  if (!result.ok) {
    throw new HostError(
      "INVALID",
      result.diagnostics.map((item) => item.message).join("; "),
    );
  }
  const halted = commitTransition(ctx, {
    runId,
    flowId: run.flowId,
    artifactId: run.artifactId,
    revision: restored.state.revision,
    stateEpoch: run.stateEpoch,
    progressionMode: run.progressionMode,
    transition: result.transition,
    command,
  });
  afterPersist(ctx, {
    transition: result.transition,
    mode: run.progressionMode,
    halted,
    publish,
  });
  return { ok: true, duplicate: false };
};
