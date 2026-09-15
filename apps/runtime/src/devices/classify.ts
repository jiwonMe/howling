/**
 * HA entity domain을 Howling 기기 종류로 좁힌다.
 */
import type { DeviceAction, DeviceKind } from "@howling/contracts";
import { parseHaNumber } from "../ha/match.js";

export type ClassifiedDevice = {
  readonly kind: DeviceKind;
  readonly actions: readonly DeviceAction[];
  readonly numeric: boolean;
};

const SWITCH_ACTIONS: readonly DeviceAction[] = ["turn_on", "turn_off", "toggle"];

const KIND_BY_DOMAIN: Readonly<Record<string, DeviceKind>> = {
  sensor: "number",
  input_number: "number",
  number: "number",
  light: "light",
  switch: "switch",
  input_boolean: "boolean",
  fan: "fan",
};

export const domainOf = (entityId: string): string => entityId.split(".")[0] ?? "";

export const classifyEntity = (entityId: string, state: string): ClassifiedDevice | undefined => {
  const kind = KIND_BY_DOMAIN[domainOf(entityId)];
  if (!kind) {
    return undefined;
  }
  const numeric = parseHaNumber(state) !== undefined;
  if (kind === "number") {
    return { kind, actions: [], numeric };
  }
  return { kind, actions: SWITCH_ACTIONS, numeric };
};

export const displayNameOf = (entityId: string, friendlyName?: string): string => {
  if (friendlyName && friendlyName.trim() !== "") {
    return friendlyName.trim();
  }
  const tail = entityId.split(".").at(-1) ?? "device";
  return tail.replaceAll("_", " ");
};

export const actionsOf = (kind: DeviceKind): readonly DeviceAction[] =>
  kind === "number" ? [] : SWITCH_ACTIONS;
