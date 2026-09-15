/**
 * Howling 동작을 허브 서비스 이름으로 옮긴다.
 */
import type { DeviceAction, DeviceKind } from "@howling/contracts";

export const serviceOf = (kind: DeviceKind, action: DeviceAction): string => {
  if (kind === "cover") {
    return coverService(action);
  }
  if (kind === "valve") {
    return valveService(action);
  }
  if (kind === "vacuum" && action === "dock") {
    return "return_to_base";
  }
  if (kind === "mower" && action === "start") {
    return "start_mowing";
  }
  return action;
};

const coverService = (action: DeviceAction): string => {
  if (action === "open") {
    return "open_cover";
  }
  if (action === "close") {
    return "close_cover";
  }
  if (action === "stop") {
    return "stop_cover";
  }
  return action;
};

const valveService = (action: DeviceAction): string => {
  if (action === "open") {
    return "open_valve";
  }
  if (action === "close") {
    return "close_valve";
  }
  if (action === "stop") {
    return "stop_valve";
  }
  return action;
};
