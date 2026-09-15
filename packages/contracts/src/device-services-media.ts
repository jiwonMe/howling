/**
 * 플레이어·리모컨 HA 도메인 서비스. entity_id 필드는 없다.
 */
import type { DeviceService } from "./device-services-types.js";

const POWER: readonly DeviceService[] = [{ action: "turn_on" }, { action: "turn_off" }];

const COMMANDS = [
  "wakeup",
  "suspend",
  "home",
  "top_menu",
  "menu",
  "select",
  "play",
  "pause",
  "up",
  "down",
  "left",
  "right",
  "volume_up",
  "volume_down",
  "previous",
  "next",
  "skip_backward",
  "skip_forward",
].map((key) => ({ key, name: key }));

export const PLAYER_SERVICES: readonly DeviceService[] = [
  ...POWER,
  { action: "toggle" },
  { action: "volume_up" },
  { action: "volume_down" },
  {
    action: "volume_set",
    fields: [{ key: "volume_level", label: "볼륨", type: "number", required: true }],
  },
  {
    action: "volume_mute",
    fields: [{ key: "is_volume_muted", label: "음소거", type: "boolean", required: true }],
  },
  { action: "media_play" },
  { action: "media_pause" },
  { action: "media_stop" },
  { action: "media_play_pause" },
  { action: "media_next_track" },
  { action: "media_previous_track" },
  {
    action: "play_media",
    fields: [
      { key: "media_content_id", label: "미디어", type: "text", required: true },
      { key: "media_content_type", label: "형식", type: "text", required: true },
    ],
  },
  {
    action: "select_source",
    fields: [{ key: "source", label: "소스", type: "text", required: true }],
  },
  {
    action: "media_seek",
    fields: [{ key: "seek_position", label: "위치", type: "number", required: true }],
  },
];

export const REMOTE_SERVICES: readonly DeviceService[] = [
  ...POWER,
  {
    action: "send_command",
    fields: [
      { key: "command", label: "명령", type: "select", required: true, options: COMMANDS },
      { key: "num_repeats", label: "반복", type: "number", required: false },
      { key: "delay_secs", label: "간격(초)", type: "number", required: false },
      { key: "hold_secs", label: "길게(초)", type: "number", required: false },
    ],
  },
];
