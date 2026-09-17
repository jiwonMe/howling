/**
 * 시간 기반 트리거 설정. 기기·HA 트리거 config는 devices.ts에 있다.
 */
import { z } from "zod";
import { deviceTriggerConfigSchema } from "./devices.js";
import type { TriggerKind } from "./flow.js";

export const TRIGGER_KINDS: readonly TriggerKind[] = [
  "device.changed",
  "ha.state_changed",
  "sun",
  "schedule",
  "manual",
  "timer",
];

/**
 * 일출·일몰 기준. offsetMinutes가 음수면 그만큼 먼저 실행한다.
 * 시각은 runtime이 HA의 sun 정보에서 읽는다.
 */
export const sunTriggerConfigSchema = z.object({
  event: z.enum(["sunset", "sunrise"]),
  offsetMinutes: z.number().int().min(-720).max(720).default(0),
});

/** 매일 같은 시각. runtime 로컬 시간대. days는 0(일)~6(토), 비우면 매일. */
export const scheduleTriggerConfigSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm"),
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});

/** sun은 HA에서 일출·일몰을 읽으므로 HA 연결이 필요하다. */
export const triggerNeedsHa = (kind: string): boolean =>
  kind === "ha.state_changed" || kind === "device.changed" || kind === "sun";

export const haStateTriggerConfigSchema = z.object({
  entityId: z.string().min(1),
  inputKey: z.string().min(1).optional(),
});

const bindingBase = {
  id: z.string().min(1),
  connectionId: z.string().nullable().default(null),
};

/** 초안·revision에 들어가는 트리거 하나. kind별 config를 검사한다. */
export const triggerBindingSchema = z.discriminatedUnion("kind", [
  z.object({ ...bindingBase, kind: z.literal("device.changed"), config: deviceTriggerConfigSchema }),
  z.object({ ...bindingBase, kind: z.literal("ha.state_changed"), config: haStateTriggerConfigSchema }),
  z.object({ ...bindingBase, kind: z.literal("sun"), config: sunTriggerConfigSchema }),
  z.object({ ...bindingBase, kind: z.literal("schedule"), config: scheduleTriggerConfigSchema }),
  z.object({ ...bindingBase, kind: z.literal("manual"), config: z.record(z.unknown()).default({}) }),
  z.object({ ...bindingBase, kind: z.literal("timer"), config: z.record(z.unknown()).default({}) }),
]);

export const triggerListSchema = z.array(triggerBindingSchema);

export type SunTriggerConfig = z.infer<typeof sunTriggerConfigSchema>;
export type ScheduleTriggerConfig = z.infer<typeof scheduleTriggerConfigSchema>;
export type HaStateTriggerConfig = z.infer<typeof haStateTriggerConfigSchema>;
