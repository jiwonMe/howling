/**
 * Howling 기기 카탈로그. entity_id는 여기에 없다.
 */
import { z } from "zod";
import { looksLikeEntityId } from "./device-state.js";

const publicTextSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !looksLikeEntityId(value), "entity id는 넣을 수 없습니다.");

export const deviceKindSchema = z.enum([
  "number",
  "sensor",
  "binary",
  "light",
  "switch",
  "boolean",
  "fan",
  "player",
  "remote",
  "climate",
  "humidifier",
  "water",
  "cover",
  "lock",
  "valve",
  "vacuum",
  "mower",
  "siren",
  "button",
  "scene",
  "select",
  "camera",
  "alarm",
  "air",
  "weather",
]);

export const deviceActionSchema = z.string().min(1).max(64);

export const DEVICE_KIND_LABELS: Readonly<Record<z.infer<typeof deviceKindSchema>, string>> = {
  number: "숫자",
  sensor: "센서",
  binary: "감지",
  light: "조명",
  switch: "스위치",
  boolean: "스위치",
  fan: "팬",
  player: "플레이어",
  remote: "리모컨",
  climate: "냉난방",
  humidifier: "가습기",
  water: "온수",
  cover: "커버",
  lock: "잠금",
  valve: "밸브",
  vacuum: "청소기",
  mower: "잔디깎이",
  siren: "사이렌",
  button: "버튼",
  scene: "장면",
  select: "선택",
  camera: "카메라",
  alarm: "경보",
  air: "공기",
  weather: "날씨",
};

export const DEVICE_ACTION_LABELS: Readonly<Record<string, string>> = {
  turn_on: "켜기",
  turn_off: "끄기",
  toggle: "전환",
  open: "열기",
  close: "닫기",
  stop: "멈춤",
  lock: "잠금",
  unlock: "잠금 해제",
  press: "누르기",
  start: "시작",
  pause: "일시정지",
  dock: "복귀",
  set_value: "값 설정",
  volume_up: "볼륨 올리기",
  volume_down: "볼륨 내리기",
  volume_set: "볼륨",
  volume_mute: "음소거",
  media_play: "재생",
  media_pause: "일시정지",
  media_stop: "정지",
  media_play_pause: "재생/일시정지",
  media_next_track: "다음",
  media_previous_track: "이전",
  play_media: "미디어 재생",
  select_source: "소스",
  media_seek: "위치",
  send_command: "명령",
  set_percentage: "세기",
  set_preset_mode: "모드",
  oscillate: "회전",
  set_direction: "방향",
  set_temperature: "온도",
  set_hvac_mode: "냉난방 모드",
  set_fan_mode: "바람",
  set_humidity: "습도",
  set_mode: "모드",
  set_operation_mode: "운전 모드",
  set_cover_position: "위치",
  set_valve_position: "위치",
  locate: "찾기",
  set_fan_speed: "세기",
  select_option: "선택",
  alarm_arm_home: "재실 경계",
  alarm_arm_away: "외출 경계",
  alarm_arm_night: "야간 경계",
  alarm_disarm: "해제",
  alarm_trigger: "경보",
};

export const actionLabel = (action: string): string => DEVICE_ACTION_LABELS[action] ?? action;

export const deviceSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: deviceKindSchema,
    actions: z.array(deviceActionSchema),
    numeric: z.boolean(),
    available: z.boolean(),
    state: publicTextSchema.optional(),
    reading: publicTextSchema.optional(),
  })
  .strict();

export const devicesSnapshotSchema = z.object({
  devices: z.array(deviceSummarySchema),
});

export const deviceTriggerConfigSchema = z.object({
  deviceId: z.string().min(1),
  inputKey: z.string().min(1),
});

const actionDataSchema = z
  .record(z.string().max(64), z.union([z.string().max(256), z.number(), z.boolean()]))
  .refine((data) => !("entity_id" in data) && !("entityId" in data), "entity id는 넣을 수 없습니다.");

export const deviceActionRequestSchema = z.object({
  deviceId: z.string().min(1),
  action: deviceActionSchema,
  data: actionDataSchema.optional(),
});

export const deviceActionBodySchema = z.object({
  action: deviceActionSchema,
  data: actionDataSchema.optional(),
});

export const deviceActionInvokeSchema = deviceActionRequestSchema.and(
  z.object({ requestId: z.string().min(1) }),
);

export const deviceActionResultSchema = z
  .object({
    requestId: z.string().min(1),
    device: deviceSummarySchema.optional(),
    error: z.string().min(1).optional(),
  })
  .strict();

export const helperDeviceKindSchema = z.enum(["number", "boolean"]);
export const creatableDeviceKindSchema = deviceKindSchema;

const hasCreateTarget = (body: {
  readonly kind?: string | undefined;
  readonly product?: string | undefined;
}): boolean => Boolean(body.kind) !== Boolean(body.product) && Boolean(body.kind ?? body.product);

export const deviceCreateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    kind: deviceKindSchema.optional(),
    product: z.string().trim().min(1).max(64).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
  })
  .refine(hasCreateTarget, "종류 또는 제품이 필요합니다.");

export const deviceCreateRequestSchema = deviceCreateBodySchema.and(
  z.object({ requestId: z.string().min(1) }),
);

export const deviceCreateResultSchema = z
  .object({
    requestId: z.string().min(1),
    device: deviceSummarySchema.optional(),
    devices: z.array(deviceSummarySchema).optional(),
    error: z.string().min(1).optional(),
  })
  .strict();

export type DeviceKind = z.infer<typeof deviceKindSchema>;
export type DeviceAction = z.infer<typeof deviceActionSchema>;
export type DeviceSummary = z.infer<typeof deviceSummarySchema>;
export type DevicesSnapshot = z.infer<typeof devicesSnapshotSchema>;
export type DeviceTriggerConfig = z.infer<typeof deviceTriggerConfigSchema>;
export type DeviceActionRequest = z.infer<typeof deviceActionRequestSchema>;
export type DeviceActionBody = z.infer<typeof deviceActionBodySchema>;
export type DeviceActionInvoke = z.infer<typeof deviceActionInvokeSchema>;
export type DeviceActionResult = z.infer<typeof deviceActionResultSchema>;
export type HelperDeviceKind = z.infer<typeof helperDeviceKindSchema>;
export type CreatableDeviceKind = z.infer<typeof creatableDeviceKindSchema>;
export type DeviceCreateBody = z.infer<typeof deviceCreateBodySchema>;
export type DeviceCreateRequest = z.infer<typeof deviceCreateRequestSchema>;
export type DeviceCreateResult = z.infer<typeof deviceCreateResultSchema>;

export const isHelperCreate = (body: {
  readonly kind?: DeviceKind | undefined;
  readonly product?: string | undefined;
}): boolean =>
  (body.product === undefined || body.product === "") &&
  (body.kind === "boolean" || body.kind === "number");
