/**
 * Listen 전 재시작 복구. 계획 12.4.
 */
import type { EffectRecord } from "../store/core-types.js";
import { listAllOutboxByStatus, upsertOutbox } from "../store/outbox.js";
import { listPending } from "../store/pending.js";
import { getRun, listOpenRuns } from "../store/runs.js";
import { restoreRun } from "./compile.js";
import type { HostContext } from "./context.js";
import { canAutoStep, isTerminalStatus } from "./status.js";
import type { InboxMessage } from "./types.js";

export const recoverHost = (ctx: HostContext): void => {
  replayPending(ctx);
  markLostDispatches(ctx);
  resumeOpenRuns(ctx);
};

const replayPending = (ctx: HostContext): void => {
  for (const item of listPending(ctx.db)) {
    const message = item.payload as InboxMessage;
    if (!message || typeof message !== "object" || !("kind" in message)) {
      continue;
    }
    void ctx.inbox.enqueue(message);
  }
};

const pendingEffectIds = (ctx: HostContext): Set<string> => {
  const ids = new Set<string>();
  for (const item of listPending(ctx.db)) {
    const message = item.payload as InboxMessage;
    if (
      message.kind === "core_command" &&
      message.command.type === "effect.resolved"
    ) {
      ids.add(message.command.effectId);
    }
  }
  return ids;
};

const markLostDispatches = (ctx: HostContext): void => {
  const pending = pendingEffectIds(ctx);
  for (const row of listAllOutboxByStatus(ctx.db, "dispatchStarted")) {
    if (pending.has(row.effectId)) {
      continue;
    }
    const reason = "no response after dispatchStarted";
    const run = getRun(ctx.db, row.runId);
    if (!run || isTerminalStatus(run.status)) {
      upsertOutbox(ctx.db, {
        ...row,
        status: "unknown",
        response: { source: "live", status: "unknown", reason },
      });
      continue;
    }
    void ctx.inbox.enqueue({
      kind: "core_command",
      runId: row.runId,
      command: {
        type: "effect.resolved",
        commandId: `unknown:${row.effectId}`,
        effectId: row.effectId,
        response: { source: "live", status: "unknown", reason },
      },
    });
  }
};

const resumeOpenRuns = (ctx: HostContext): void => {
  for (const run of listOpenRuns(ctx.db)) {
    const restored = restoreRun(ctx, run);
    const blocked = restored.state.paused || restored.state.cancelled;
    for (const record of Object.values(restored.state.effects)) {
      if (record.status !== "requested" || blocked) {
        continue;
      }
      recoverRequested(ctx, record);
    }
    if (canAutoStep(restored.state, run.progressionMode)) {
      void ctx.inbox.enqueue({ kind: "step", runId: run.runId });
    }
  }
};

const recoverRequested = (ctx: HostContext, record: EffectRecord): void => {
  if (record.intent.kind === "timer") {
    if (record.intent.dueAt <= ctx.now()) {
      const logicalTime = Math.max(record.intent.dueAt, ctx.now());
      void ctx.inbox.enqueue({
        kind: "core_command",
        runId: record.runId,
        command: {
          type: "clock.advanced",
          commandId: `clock:${record.id}:${String(logicalTime)}`,
          logicalTime,
        },
      });
      void ctx.inbox.enqueue({
        kind: "core_command",
        runId: record.runId,
        command: {
          type: "effect.resolved",
          commandId: `timer:${record.id}`,
          effectId: record.id,
          response: {
            source: "live",
            status: "succeeded",
            value: { dueAt: record.intent.dueAt },
          },
        },
      });
      return;
    }
    ctx.timers.schedule(record);
    return;
  }
  void ctx.inbox.enqueue({
    kind: "dispatch",
    runId: record.runId,
    effectId: record.id,
  });
};
