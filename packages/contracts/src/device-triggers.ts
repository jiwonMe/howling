/**
 * device.changed가 어떤 기기를 보고, 어떤 키로 값을 올릴지.
 */
import type { DeviceKind } from "./devices.js";
import type { VirtualFieldState } from "./device-virtual-fields.js";

const PRIMARY_KEYS = new Set(["state", "value", "power"]);

export const isTriggerableDevice = (item: {
  readonly kind: DeviceKind;
  readonly numeric?: boolean;
  readonly fields?: readonly VirtualFieldState[] | undefined;
}): boolean => {
  if (item.kind === "number") {
    return item.numeric === true;
  }
  if (item.kind === "binary" || item.kind === "boolean" || item.kind === "switch") {
    return true;
  }
  return item.kind === "fields" && (item.fields?.length ?? 0) > 0;
};

export const defaultTriggerKey = (item: {
  readonly kind: DeviceKind;
  readonly fields?: readonly VirtualFieldState[] | undefined;
}): string => {
  if (item.kind === "fields") {
    return item.fields?.find((field) => field.key === "state")?.key ?? item.fields?.[0]?.key ?? "state";
  }
  if (item.kind === "binary") {
    return "value";
  }
  if (item.kind === "boolean" || item.kind === "switch") {
    return "state";
  }
  return "power";
};

export const isPrimaryTriggerKey = (key: string): boolean => PRIMARY_KEYS.has(key);

export const booleanTriggerOf = (raw: string | number | boolean): boolean | undefined => {
  if (raw === true) {
    return true;
  }
  if (raw === false) {
    return false;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const text = raw.trim().toLowerCase();
  if (text === "true" || text === "on" || text === "open" || text === "unlocked" || text === "detected") {
    return true;
  }
  if (text === "false" || text === "off" || text === "closed" || text === "locked" || text === "clear") {
    return false;
  }
  return undefined;
};
