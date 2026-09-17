/**
 * HA state_changed를 trigger와 맞춘다.
 */
import { FIELDS_ATTR, booleanTriggerOf, isPrimaryTriggerKey, valueAttrsOf } from "@howling/contracts";

export type DeviceTriggerInput = Record<string, string | number | boolean>;

export const parseHaNumber = (value: string): number | undefined => {
  if (value === "" || value === "unknown" || value === "unavailable") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const isStateValueChange = (
  previous: string | undefined,
  next: string,
): boolean => previous !== next;

export const isRecoveryFromUnknown = (previous?: string): boolean =>
  previous === "unknown" || previous === "unavailable";

export const matchHaNumericTrigger = (input: {
  readonly entityId: string;
  readonly wanted: string;
  readonly previous?: string;
  readonly next: string;
  readonly syncing: boolean;
  readonly inputKey: string;
}): Record<string, number> | undefined => {
  if (input.syncing || input.entityId !== input.wanted) {
    return undefined;
  }
  if (!isStateValueChange(input.previous, input.next)) {
    return undefined;
  }
  if (isRecoveryFromUnknown(input.previous)) {
    return undefined;
  }
  const value = parseHaNumber(input.next);
  if (value === undefined) {
    return undefined;
  }
  return { [input.inputKey]: value };
};

export const matchDeviceTrigger = (input: {
  readonly entityId: string;
  readonly wanted: string;
  readonly previous?: string;
  readonly next: string;
  readonly syncing: boolean;
  readonly inputKey: string;
  readonly attrs?: Record<string, string | number | boolean>;
  readonly previousAttrs?: Record<string, string | number | boolean>;
}): DeviceTriggerInput | undefined => {
  if (input.syncing || input.entityId !== input.wanted) {
    return undefined;
  }
  if (isRecoveryFromUnknown(input.previous)) {
    return undefined;
  }
  const nextRaw = watchedOf(input.inputKey, input.attrs);
  const prevRaw = watchedOf(input.inputKey, input.previousAttrs);
  if (nextRaw !== undefined && sameTriggerValue(prevRaw, nextRaw)) {
    return undefined;
  }
  if (nextRaw !== undefined) {
    return packTriggerInput(input.inputKey, nextRaw, input.attrs);
  }
  if (!isStateValueChange(input.previous, input.next)) {
    return undefined;
  }
  const numeric = parseHaNumber(input.next);
  if (numeric !== undefined) {
    return { [input.inputKey]: numeric };
  }
  const flag = booleanTriggerOf(input.next);
  return flag === undefined ? undefined : packTriggerInput(input.inputKey, flag, input.attrs);
};

export const matchPowerTrigger = (input: {
  readonly entityId: string;
  readonly wanted: string;
  readonly previous?: string;
  readonly next: string;
  readonly syncing: boolean;
}): { readonly power: number } | undefined => {
  const matched = matchHaNumericTrigger({ ...input, inputKey: "power" });
  return matched ? { power: matched.power as number } : undefined;
};

const watchedOf = (
  key: string,
  attrs?: Record<string, string | number | boolean>,
): string | number | boolean | undefined => {
  if (!attrs) {
    return undefined;
  }
  if (key !== FIELDS_ATTR && key in attrs) {
    return attrs[key];
  }
  if (isPrimaryTriggerKey(key) && "state" in attrs) {
    return attrs.state;
  }
  return undefined;
};

const sameTriggerValue = (
  left: string | number | boolean | undefined,
  right: string | number | boolean,
): boolean => left !== undefined && Object.is(left, right);

const packTriggerInput = (
  key: string,
  raw: string | number | boolean,
  attrs?: Record<string, string | number | boolean>,
): DeviceTriggerInput => {
  const value = booleanTriggerOf(raw) ?? raw;
  const packed: DeviceTriggerInput = { [key]: value };
  if (typeof value === "boolean") {
    packed.state = packed.state ?? value;
    packed.value = packed.value ?? value;
    packed.on = packed.on ?? value;
  }
  if (!attrs) {
    return packed;
  }
  for (const [field, item] of Object.entries(valueAttrsOf(attrs))) {
    if (packed[field] === undefined) {
      packed[field] = item;
    }
  }
  return packed;
};
