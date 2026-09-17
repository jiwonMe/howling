/**
 * sun·schedule 트리거의 다음 실행 시각(ms). 순수 함수라 시계를 주입해 검증한다.
 */
import {
  scheduleTriggerConfigSchema,
  sunTriggerConfigSchema,
  type TriggerBinding,
} from "@howling/contracts";
import type { JsonObject } from "@howling/core";

/** HA sun.sun attributes에서 읽은 다음 일출·일몰. ISO 문자열. */
export type SunTimes = {
  readonly nextSetting: string | null;
  readonly nextRising: string | null;
};

/** due를 지난 뒤에도 이 시간 안이면 실행한다(재시작·틱 간격 보정). */
export const GRACE_MS = 5 * 60_000;

/** 실행 input에 그대로 들어가는 트리거 설명. JSON 값만. */
export type TriggerInput = JsonObject;

export type Due = { readonly due: number; readonly input: TriggerInput };

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const parseIso = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const sunDue = (
  config: unknown,
  sun: SunTimes | undefined,
): Due | undefined => {
  const parsed = sunTriggerConfigSchema.safeParse(config);
  if (!parsed.success || !sun) {
    return undefined;
  }
  const base = parseIso(parsed.data.event === "sunset" ? sun.nextSetting : sun.nextRising);
  if (base === undefined) {
    return undefined;
  }
  const due = base + parsed.data.offsetMinutes * MINUTE_MS;
  return {
    due,
    input: {
      kind: "sun",
      event: parsed.data.event,
      offsetMinutes: parsed.data.offsetMinutes,
      eventAt: new Date(base).toISOString(),
      at: new Date(due).toISOString(),
    },
  };
};

/** 오늘(로컬) HH:mm. 이미 grace를 넘겼으면 days에 맞는 다음 날. */
const nextLocalOccurrence = (
  nowMs: number,
  hour: number,
  minute: number,
  days: readonly number[] | undefined,
): number => {
  const candidate = new Date(nowMs);
  candidate.setHours(hour, minute, 0, 0);
  let due = candidate.getTime();
  for (let step = 0; step < 8; step += 1) {
    const fits = !days || days.length === 0 || days.includes(new Date(due).getDay());
    if (fits && due + GRACE_MS > nowMs) {
      return due;
    }
    const next = new Date(due + DAY_MS);
    next.setHours(hour, minute, 0, 0);
    due = next.getTime();
  }
  return due;
};

export const scheduleDue = (
  config: unknown,
  nowMs: number,
): Due | undefined => {
  const parsed = scheduleTriggerConfigSchema.safeParse(config);
  if (!parsed.success) {
    return undefined;
  }
  const [hour, minute] = parsed.data.time.split(":").map(Number) as [number, number];
  const due = nextLocalOccurrence(nowMs, hour, minute, parsed.data.days);
  return {
    due,
    input: {
      kind: "schedule",
      time: parsed.data.time,
      ...(parsed.data.days ? { days: parsed.data.days } : {}),
      at: new Date(due).toISOString(),
    },
  };
};

export const dueOf = (
  trigger: TriggerBinding,
  nowMs: number,
  sun: SunTimes | undefined,
): Due | undefined => {
  if (trigger.kind === "sun") {
    return sunDue(trigger.config, sun);
  }
  if (trigger.kind === "schedule") {
    return scheduleDue(trigger.config, nowMs);
  }
  return undefined;
};
