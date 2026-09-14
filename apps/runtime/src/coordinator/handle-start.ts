/**
 * TriggerInbox 수락과 startRun.
 */
import { randomUUID } from "node:crypto";
import { getArtifact, getDeployment } from "../store/artifacts.js";
import { sha256Json } from "../store/hash.js";
import { loadNodeStates } from "../store/node-states.js";
import { holdingRun } from "../store/runs.js";
import {
  QUEUE_LIMIT,
  TRIGGER_TTL_MS,
  findTriggerByKey,
  getTrigger,
  insertTrigger,
  markTriggerStarted,
  queuedCount,
} from "../store/triggers.js";
import { compileArtifact } from "./compile.js";
import { commitTransition } from "./commit.js";
import type { HostContext } from "./context.js";
import { HostError } from "./errors.js";
import { afterPersist } from "./follow-up.js";
import type { InboxMessage, StartRunResult } from "./types.js";

export const handleStart = (
  ctx: HostContext,
  message: Extract<InboxMessage, { kind: "start_run" }>,
): StartRunResult => {
  const artifact = getArtifact(ctx.db, message.artifactId);
  if (!artifact) {
    throw new HostError("NOT_FOUND", `artifact ${message.artifactId} not found`);
  }
  const sameKey = findTriggerByKey(ctx.db, artifact.flowId, message.idempotencyKey);
  if (sameKey && sameKey.id !== message.triggerId) {
    if (samePayload(sameKey, message)) {
      return {
        triggerId: sameKey.id,
        runId: sameKey.runId,
        status: sameKey.runId ? "duplicate" : "queued",
      };
    }
    throw new HostError("CONFLICT", "idempotency key reused with a different payload");
  }
  let trigger = getTrigger(ctx.db, message.triggerId);
  if (!trigger) {
    if (queuedCount(ctx.db, artifact.flowId) >= QUEUE_LIMIT) {
      throw new HostError("QUEUE_FULL", "trigger inbox is full");
    }
    insertTrigger(ctx.db, {
      id: message.triggerId,
      flowId: artifact.flowId,
      artifactId: artifact.id,
      input: message.input,
      mode: message.mode,
      idempotencyKey: message.idempotencyKey,
      expiresAt: new Date(ctx.now() + TRIGGER_TTL_MS).toISOString(),
    });
    trigger = getTrigger(ctx.db, message.triggerId);
  }
  if (!trigger) {
    throw new HostError("FAILED", "trigger insert failed");
  }
  if (trigger.status === "started") {
    return { triggerId: trigger.id, runId: trigger.runId, status: "duplicate" };
  }
  if (trigger.status !== "queued") {
    return { triggerId: trigger.id, runId: trigger.runId, status: "duplicate" };
  }
  if (holdingRun(ctx.db, artifact.flowId)) {
    return { triggerId: trigger.id, runId: null, status: "queued" };
  }
  return beginStart(ctx, trigger, artifact);
};

const samePayload = (
  row: { readonly input: unknown; readonly mode: string },
  message: Extract<InboxMessage, { kind: "start_run" }>,
): boolean =>
  sha256Json({ input: row.input, mode: row.mode }) ===
  sha256Json({ input: message.input, mode: message.mode });

const beginStart = (
  ctx: HostContext,
  trigger: {
    readonly id: string;
    readonly flowId: string;
    readonly artifactId: string;
    readonly input: import("@howling/core").JsonValue;
    readonly mode: import("../store/triggers.js").ProgressionMode;
  },
  artifact: { readonly id: string; readonly flowId: string; readonly revision: string },
): StartRunResult => {
  const plan = compileArtifact(ctx, artifact.id);
  const deployment = getDeployment(ctx.db, artifact.flowId);
  const stateEpoch = deployment?.stateEpoch ?? "epoch_1";
  const runId = randomUUID();
  const started = ctx.engine.startRun(plan, trigger.input, {
    runId,
    mode: "live",
    logicalTime: ctx.now(),
    initialState: loadNodeStates(ctx.db, {
      flowId: artifact.flowId,
      revision: artifact.revision,
      stateEpoch,
    }),
  });
  if (!started.ok) {
    throw new HostError(
      "FAILED",
      started.diagnostics.map((item) => item.message).join("; "),
    );
  }
  const halted = commitTransition(ctx, {
    runId,
    flowId: artifact.flowId,
    artifactId: artifact.id,
    revision: artifact.revision,
    stateEpoch,
    progressionMode: trigger.mode,
    transition: started.transition,
  });
  markTriggerStarted(ctx.db, trigger.id, runId);
  afterPersist(ctx, {
    transition: started.transition,
    mode: trigger.mode,
    halted,
    publish: "new",
  });
  return { triggerId: trigger.id, runId, status: "started" };
};
