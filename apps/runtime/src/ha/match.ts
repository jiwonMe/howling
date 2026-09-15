/**
 * HA state_changed를 trigger와 맞춘다.
 */
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
}): Record<string, number> | undefined => {
  const numeric = matchHaNumericTrigger(input);
  if (numeric) {
    return numeric;
  }
  if (input.syncing || input.entityId !== input.wanted) {
    return undefined;
  }
  if (!isStateValueChange(input.previous, input.next) || isRecoveryFromUnknown(input.previous)) {
    return undefined;
  }
  const bit = binaryBit(input.next);
  return bit === undefined ? undefined : { [input.inputKey]: bit };
};

const binaryBit = (value: string): number | undefined => {
  if (value === "on" || value === "open" || value === "unlocked" || value === "detected") {
    return 1;
  }
  if (value === "off" || value === "closed" || value === "locked" || value === "clear") {
    return 0;
  }
  return undefined;
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
