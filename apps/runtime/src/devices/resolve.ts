/**
 * deviceId + action을 HA call_service 입력으로 푼다.
 */
import { actionsOf, type DeviceAction } from "@howling/contracts";
import type Database from "better-sqlite3";
import { domainOf, serviceOf } from "./classify.js";
import { getDevice } from "./store.js";

export type ResolvedAction = {
  readonly domain: string;
  readonly service: string;
  readonly service_data: Record<string, string | number | boolean>;
};

export const resolveAction = (
  db: Database.Database,
  deviceId: string,
  action: DeviceAction,
  data?: Record<string, string | number | boolean>,
): ResolvedAction | undefined => {
  const row = getDevice(db, deviceId);
  if (!row || !row.available || row.origin === "virtual") {
    return undefined;
  }
  if (!actionsOf(row.kind).includes(action)) {
    return undefined;
  }
  return {
    domain: domainOf(row.entityId),
    service: serviceOf(row.kind, action),
    service_data: { ...publicData(data), entity_id: row.entityId },
  };
};

const publicData = (
  data?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> => {
  if (!data) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== "entity_id" && key !== "entityId"),
  );
};
