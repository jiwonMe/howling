/**
 * 활성 revision의 sun·schedule 트리거를 시각이 되면 inbox에 넣는다.
 * due는 미래일 때 한 번 기억하고, HA의 next_setting이 다음 날로 넘어가도 잊지 않는다.
 */
import { randomUUID } from "node:crypto";
import type { TriggerBinding } from "@howling/contracts";
import type { RuntimeHost } from "../coordinator/host.js";
import type { HaHandle } from "../ha/client.js";
import { listActiveArtifacts } from "../store/artifacts.js";
import { GRACE_MS, dueOf, type SunTimes, type TriggerInput } from "./due.js";

type Pending = { due: number; input: TriggerInput; fired: boolean };

export type TimeTriggerClock = {
  readonly host: RuntimeHost;
  readonly sun: () => SunTimes | undefined;
  readonly pending?: Map<string, Pending>;
};

/** 한 번 돌며 due가 된 트리거를 시작한다. 시작한 개수를 돌려준다. */
export const tickTimeTriggers = (clock: TimeTriggerClock): number => {
  const pending = clock.pending ?? new Map<string, Pending>();
  const now = clock.host.now();
  const sun = clock.sun();
  let started = 0;
  const seen = new Set<string>();
  for (const row of listActiveArtifacts(clock.host.db)) {
    const triggers = Array.isArray(row.triggers) ? (row.triggers as TriggerBinding[]) : [];
    for (const trigger of triggers) {
      if (trigger.kind !== "sun" && trigger.kind !== "schedule") {
        continue;
      }
      const key = `${row.artifact.id}:${trigger.id}`;
      seen.add(key);
      const item = track(pending, key, trigger, now, sun);
      if (!item || item.fired || now < item.due || now >= item.due + GRACE_MS) {
        continue;
      }
      item.fired = true;
      started += 1;
      void clock.host.enqueue({
        kind: "start_run",
        triggerId: randomUUID(),
        artifactId: row.artifact.id,
        input: { trigger: item.input },
        mode: "auto",
        idempotencyKey: `${key}:${new Date(item.due).toISOString()}`,
      });
    }
  }
  for (const key of pending.keys()) {
    if (!seen.has(key)) {
      pending.delete(key);
    }
  }
  return started;
};

/** 기억한 due가 아직 유효하면 그대로, 지났거나 없으면 다시 계산한다. */
const track = (
  pending: Map<string, Pending>,
  key: string,
  trigger: TriggerBinding,
  now: number,
  sun: SunTimes | undefined,
): Pending | undefined => {
  const current = pending.get(key);
  if (current && !current.fired && now < current.due + GRACE_MS) {
    return current;
  }
  const next = dueOf(trigger, now, sun);
  if (!next || next.due + GRACE_MS <= now) {
    return current;
  }
  if (current?.fired && current.due === next.due) {
    return current;
  }
  const item: Pending = { due: next.due, input: next.input, fired: false };
  pending.set(key, item);
  return item;
};

/** HA sun.sun을 주기적으로 읽어 캐시한다. HA가 없으면 undefined. */
export const createSunClock = (input: {
  readonly ha: () => HaHandle | undefined;
  readonly refreshMs?: number;
  readonly now?: () => number;
}): { readonly sun: () => SunTimes | undefined; readonly refresh: () => Promise<void> } => {
  const now = input.now ?? (() => Date.now());
  const refreshMs = input.refreshMs ?? 10 * 60_000;
  let cached: SunTimes | undefined;
  let fetchedAt = 0;
  let inflight: Promise<void> | undefined;
  const refresh = async (): Promise<void> => {
    const ha = input.ha();
    if (!ha || ha.status() !== "ready") {
      return;
    }
    try {
      const raw = (await ha.rest("GET", "/api/states/sun.sun")) as {
        attributes?: { next_setting?: string; next_rising?: string };
      };
      cached = {
        nextSetting: raw?.attributes?.next_setting ?? null,
        nextRising: raw?.attributes?.next_rising ?? null,
      };
      fetchedAt = now();
    } catch {
      // 다음 틱에 다시 읽는다.
    }
  };
  return {
    sun: () => {
      if (now() - fetchedAt >= refreshMs && !inflight) {
        inflight = refresh().finally(() => {
          inflight = undefined;
        });
      }
      return cached;
    },
    refresh,
  };
};

export const startTimeTriggers = (input: {
  readonly host: RuntimeHost;
  readonly ha: () => HaHandle | undefined;
  readonly intervalMs?: number;
}): { readonly stop: () => void } => {
  const sunClock = createSunClock({ ha: input.ha });
  const pending = new Map<string, Pending>();
  const timer = setInterval(() => {
    try {
      tickTimeTriggers({ host: input.host, sun: sunClock.sun, pending });
    } catch {
      // 트리거 계산 실패는 runtime을 멈추지 않는다.
    }
  }, input.intervalMs ?? 20_000);
  return { stop: () => clearInterval(timer) };
};
