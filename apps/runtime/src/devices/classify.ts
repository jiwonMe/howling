/**
 * HA entity domain을 Howling 기기 종류로 옮긴다.
 */
import { actionsOf, type DeviceAction, type DeviceKind } from "@howling/contracts";
import { parseHaNumber } from "../ha/match.js";

export type ClassifiedDevice = {
  readonly kind: DeviceKind;
  readonly actions: readonly DeviceAction[];
  readonly numeric: boolean;
};

export { actionsOf } from "@howling/contracts";
export { serviceOf } from "./classify-actions.js";

const KIND_BY_DOMAIN: Readonly<Record<string, DeviceKind>> = {
  input_number: "number",
  number: "number",
  counter: "number",
  binary_sensor: "binary",
  light: "light",
  switch: "switch",
  input_boolean: "boolean",
  fan: "fan",
  media_player: "player",
  remote: "remote",
  climate: "climate",
  humidifier: "humidifier",
  water_heater: "water",
  cover: "cover",
  lock: "lock",
  valve: "valve",
  vacuum: "vacuum",
  lawn_mower: "mower",
  siren: "siren",
  button: "button",
  input_button: "button",
  scene: "scene",
  script: "scene",
  select: "select",
  input_select: "select",
  camera: "camera",
  alarm_control_panel: "alarm",
  weather: "weather",
};

export const domainOf = (entityId: string): string => entityId.split(".")[0] ?? "";

export const helperItemIdOf = (entityId: string): string =>
  entityId.slice(domainOf(entityId).length + 1);

export const classifyEntity = (entityId: string, state: string): ClassifiedDevice | undefined => {
  const domain = domainOf(entityId);
  const numeric = parseHaNumber(state) !== undefined;
  const kind = kindOf(domain, numeric);
  if (!kind) {
    return undefined;
  }
  return { kind, actions: actionsOf(kind), numeric };
};

export const displayNameOf = (entityId: string, friendlyName?: string): string => {
  if (friendlyName && friendlyName.trim() !== "") {
    return friendlyName.trim();
  }
  const tail = entityId.split(".").at(-1) ?? "device";
  return tail.replaceAll("_", " ");
};

const kindOf = (domain: string, numeric: boolean): DeviceKind | undefined => {
  if (domain === "sensor") {
    return numeric ? "number" : "sensor";
  }
  if (domain === "air_quality") {
    return numeric ? "number" : "air";
  }
  return KIND_BY_DOMAIN[domain];
};
