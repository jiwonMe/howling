/**
 * 집 기기 HA 도메인 서비스. entity_id 필드는 없다.
 */
import { field, type DeviceService } from "./device-services-types.js";

const SWITCH: readonly DeviceService[] = [
  { action: "turn_on" },
  { action: "turn_off" },
  { action: "toggle" },
];
const POWER: readonly DeviceService[] = [{ action: "turn_on" }, { action: "turn_off" }];
const OPEN: readonly DeviceService[] = [
  { action: "open" },
  { action: "close" },
  { action: "stop" },
  { action: "toggle" },
];

export const HOME_SERVICES = {
  number: [{ action: "set_value", fields: [field("value", "값", "number", true)] }],
  sensor: [],
  binary: [],
  light: [
    { action: "turn_on", fields: [field("brightness", "밝기", "number")] },
    { action: "turn_off" },
    { action: "toggle" },
  ],
  switch: SWITCH,
  boolean: SWITCH,
  fan: [
    ...SWITCH,
    { action: "set_percentage", fields: [field("percentage", "세기", "number", true)] },
    { action: "set_preset_mode", fields: [field("preset_mode", "모드", "text", true)] },
    { action: "oscillate", fields: [field("oscillating", "회전", "boolean", true)] },
    { action: "set_direction", fields: [field("direction", "방향", "text", true)] },
  ],
  climate: [
    ...POWER,
    { action: "set_temperature", fields: [field("temperature", "온도", "number", true)] },
    { action: "set_hvac_mode", fields: [field("hvac_mode", "냉난방", "text", true)] },
    { action: "set_fan_mode", fields: [field("fan_mode", "바람", "text", true)] },
    { action: "set_humidity", fields: [field("humidity", "습도", "number", true)] },
    { action: "set_preset_mode", fields: [field("preset_mode", "모드", "text", true)] },
  ],
  humidifier: [
    ...SWITCH,
    { action: "set_humidity", fields: [field("humidity", "습도", "number", true)] },
    { action: "set_mode", fields: [field("mode", "모드", "text", true)] },
  ],
  water: [
    ...POWER,
    { action: "set_temperature", fields: [field("temperature", "온도", "number", true)] },
    { action: "set_operation_mode", fields: [field("operation_mode", "모드", "text", true)] },
  ],
  cover: [...OPEN, { action: "set_cover_position", fields: [field("position", "위치", "number", true)] }],
  lock: [{ action: "lock" }, { action: "unlock" }, { action: "open" }],
  valve: [
    { action: "open" },
    { action: "close" },
    { action: "stop" },
    { action: "set_valve_position", fields: [field("position", "위치", "number", true)] },
  ],
  vacuum: [
    { action: "start" },
    { action: "pause" },
    { action: "stop" },
    { action: "dock" },
    { action: "locate" },
    { action: "set_fan_speed", fields: [field("fan_speed", "세기", "text", true)] },
  ],
  mower: [{ action: "start" }, { action: "pause" }, { action: "dock" }],
  siren: SWITCH,
  button: [{ action: "press" }],
  scene: [{ action: "turn_on" }],
  select: [{ action: "select_option", fields: [field("option", "선택", "text", true)] }],
  camera: POWER,
  alarm: [
    { action: "alarm_arm_home" },
    { action: "alarm_arm_away" },
    { action: "alarm_arm_night" },
    { action: "alarm_disarm" },
    { action: "alarm_trigger" },
  ],
  air: [],
  weather: [],
} as const satisfies Record<string, readonly DeviceService[]>;
