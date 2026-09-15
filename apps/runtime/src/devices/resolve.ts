/**
 * deviceId + action을 HA call_service 입력으로 푼다.
 */
import type { DeviceAction } from "@howling/contracts";
import type Database from "better-sqlite3";
import { actionsOf, domainOf } from "./classify.js";
import { getDevice } from "./store.js";

export type ResolvedAction = {
  readonly domain: string;
  readonly service: DeviceAction;
  readonly service_data: { readonly entity_id: string };
};

export const resolveAction = (
  db: Database.Database,
  deviceId: string,
  action: DeviceAction,
): ResolvedAction | undefined => {
  const row = getDevice(db, deviceId);
  if (!row || !row.available) {
    return undefined;
  }
  if (!actionsOf(row.kind).includes(action)) {
    return undefined;
  }
  return {
    domain: domainOf(row.entityId),
    service: action,
    service_data: { entity_id: row.entityId },
  };
};
