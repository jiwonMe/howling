/**
 * Dry-run start와 fixture 입력. live adapter는 부르지 않는다.
 */
import { randomUUID } from "node:crypto";
import type { EffectFixture, WorkflowDefinition } from "@howling/core";
import { storeArtifact } from "../store/artifacts.js";
import { getRun } from "../store/runs.js";
import { addFixture, saveTestSession } from "../store/test-sessions.js";
import { compileArtifact, restoreRun } from "./compile.js";
import { mergeFixtures } from "./dry-fixtures.js";
import { commitTransition } from "./commit.js";
import type { HostContext } from "./context.js";
import { HostError } from "./errors.js";
import { afterPersist } from "./follow-up.js";
import { requireRun } from "./require-run.js";
import type { InboxMessage, StartRunResult } from "./types.js";

export const handleDryStart = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "start_dry_run" }>,
): StartRunResult => {
  if (message.definition) {
    storeArtifact(ctx.db, {
      id: message.artifactId,
      definition: message.definition as WorkflowDefinition,
      triggers: message.triggers ?? [],
      connections: message.connections ?? [],
    });
    ctx.plans.delete(message.artifactId);
  }
  const existing = message.runId ? getRun(ctx.db, message.runId) : undefined;
  if (existing) {
    return { triggerId: message.triggerId, runId: existing.runId, status: "duplicate" };
  }
  const fixtures = mergeFixtures(message.fixtures, message.definition);
  const plan = compileArtifact(ctx, message.artifactId);
  const runId = message.runId ?? randomUUID();
  const started = ctx.engine.startRun(plan, message.input, {
    runId,
    mode: "dryRun",
    logicalTime: 0,
    initialState: message.initialState ?? {},
  });
  if (!started.ok) {
    throw new HostError(
      "FAILED",
      started.diagnostics.map((item) => item.message).join("; "),
    );
  }
  const halted = commitTransition(ctx, {
    runId,
    flowId: started.transition.state.workflowId,
    artifactId: message.artifactId,
    revision: started.transition.state.revision,
    stateEpoch: "test",
    progressionMode: message.mode,
    transition: started.transition,
  });
  saveTestSession(ctx.db, {
    id: message.testSessionId ?? randomUUID(),
    runId,
    flowId: started.transition.state.workflowId,
    artifactId: message.artifactId,
    fixtures,
    bundleVersion: message.fixtureBundleVersion,
    initialState: message.initialState,
  });
  afterPersist(ctx, {
    transition: started.transition,
    mode: message.mode,
    halted,
    publish: "new",
  });
  return { triggerId: message.triggerId, runId, status: "started" };
};

export const handleFixture = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "fixture" }>,
): unknown => {
  if (message.response.source === "live") {
    throw new HostError("INVALID", "dry-run rejects live fixture responses");
  }
  const run = requireRun(ctx, message.runId);
  const restored = restoreRun(ctx, run);
  const record = restored.state.effects[message.effectId];
  if (record) {
    const fixture: EffectFixture = {
      nodeId: record.nodeId,
      index: record.index,
      response: message.response,
    };
    addFixture(ctx.db, message.runId, fixture);
  }
  const result = ctx.engine.applyCommand(restored.plan, restored.state, {
    type: "effect.resolved",
    commandId: message.commandId,
    effectId: message.effectId,
    response: message.response,
  });
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
    command: {
      type: "effect.resolved",
      commandId: message.commandId,
      effectId: message.effectId,
      response: message.response,
    },
  });
  afterPersist(ctx, {
    transition: result.transition,
    mode: run.progressionMode,
    halted,
    publish: "new",
  });
  return { ok: true };
};
