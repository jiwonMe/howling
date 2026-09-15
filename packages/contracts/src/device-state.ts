/**
 * 기기 현재값. entity_id는 여기에 없다.
 */
export const looksLikeEntityId = (value: string): boolean =>
  /^[a-z][a-z0-9_]+\.[a-z0-9_]+$/i.test(value.trim());

export const DEVICE_STATE_LABELS: Readonly<Record<string, string>> = {
  on: "켜짐",
  off: "꺼짐",
  idle: "대기",
  playing: "재생 중",
  paused: "일시정지",
  unavailable: "불가",
  unknown: "알 수 없음",
  home: "재실",
  away: "외출",
  locked: "잠김",
  unlocked: "열림",
  open: "열림",
  closed: "닫힘",
  opening: "여는 중",
  closing: "닫는 중",
  heating: "난방",
  cooling: "냉방",
  heat: "난방",
  cool: "냉방",
  auto: "자동",
  dry: "제습",
  fan: "송풍",
  fan_only: "송풍",
  docked: "충전",
  cleaning: "청소 중",
  returning: "복귀",
  armed_home: "재실 경계",
  armed_away: "외출 경계",
  armed_night: "야간 경계",
  disarmed: "해제",
  triggered: "경보",
};

export const stateLabel = (state: string | undefined): string => {
  if (!state) {
    return "—";
  }
  return DEVICE_STATE_LABELS[state] ?? state;
};

export const onDeviceBoard = (kind: string): boolean => kind !== "sensor" && kind !== "weather";

const ATTR_KEYS = [
  "brightness",
  "volume_level",
  "temperature",
  "current_temperature",
  "humidity",
  "source",
  "media_title",
  "current_position",
  "percentage",
  "hvac_action",
] as const;

export const publicAttrsOf = (raw: unknown): Record<string, string | number | boolean> => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const attrs: Record<string, string | number | boolean> = {};
  for (const key of ATTR_KEYS) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      attrs[key] = value;
    } else if (typeof value === "boolean") {
      attrs[key] = value;
    } else if (typeof value === "string" && value !== "" && !looksLikeEntityId(value)) {
      attrs[key] = value.slice(0, 64);
    }
  }
  return attrs;
};

export const readingOf = (
  kind: string,
  attrs: Record<string, string | number | boolean>,
): string | undefined => {
  if (kind === "light" && typeof attrs.brightness === "number") {
    return `밝기 ${Math.round((attrs.brightness / 255) * 100)}%`;
  }
  if (kind === "player" && typeof attrs.volume_level === "number") {
    return `볼륨 ${Math.round(attrs.volume_level * 100)}%`;
  }
  if (kind === "player" && typeof attrs.media_title === "string") {
    return attrs.media_title;
  }
  if ((kind === "climate" || kind === "weather") && typeof attrs.current_temperature === "number") {
    return `${attrs.current_temperature}°`;
  }
  if (kind === "climate" && typeof attrs.temperature === "number") {
    return `${attrs.temperature}°`;
  }
  if (kind === "cover" && typeof attrs.current_position === "number") {
    return `${attrs.current_position}%`;
  }
  if (kind === "fan" && typeof attrs.percentage === "number") {
    return `${attrs.percentage}%`;
  }
  return undefined;
};
