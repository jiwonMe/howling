/**
 * Live timer. due 시 clock.advanced 다음 effect.resolved를 inbox에 넣는다.
 */
import { randomUUID } from "node:crypto";
import type { EffectRecord } from "../store/core-types.js";
import type { InboxHandle } from "../coordinator/inbox.js";

export interface TimerScheduler {
  readonly schedule: (record: EffectRecord) => void;
  readonly fireDue: () => void;
  readonly stop: () => void;
}

export const createTimerScheduler = (
  inbox: InboxHandle,
  now: () => number,
  options?: { readonly useTimeout?: boolean },
): TimerScheduler => {
  const useTimeout = options?.useTimeout !== false;
  const armed = new Map<
    string,
    { record: EffectRecord; timer: ReturnType<typeof setTimeout> | undefined }
  >();

  const fire = (record: EffectRecord): void => {
    if (record.intent.kind !== "timer") {
      return;
    }
    armed.delete(record.id);
    const logicalTime = Math.max(record.intent.dueAt, now());
    void inbox.enqueue({
      kind: "core_command",
      runId: record.runId,
      command: {
        type: "clock.advanced",
        commandId: `clock:${record.id}:${String(logicalTime)}`,
        logicalTime,
      },
    });
    void inbox.enqueue({
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
  };

  return {
    schedule: (record) => {
      if (record.intent.kind !== "timer" || armed.has(record.id)) {
        return;
      }
      if (record.status !== "requested") {
        return;
      }
      const wait = Math.max(0, record.intent.dueAt - now());
      const timer = useTimeout
        ? setTimeout(() => fire(record), wait)
        : undefined;
      armed.set(record.id, { record, timer });
    },
    fireDue: () => {
      const current = now();
      for (const [id, item] of armed) {
        if (item.record.intent.kind === "timer" && item.record.intent.dueAt <= current) {
          if (item.timer) {
            clearTimeout(item.timer);
          }
          armed.delete(id);
          fire(item.record);
        }
      }
    },
    stop: () => {
      for (const item of armed.values()) {
        if (item.timer) {
          clearTimeout(item.timer);
        }
      }
      armed.clear();
    },
  };
};

export const newCommandId = (): string => randomUUID();
