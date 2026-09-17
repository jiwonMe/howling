/**
 * 가상 기기 동작을 로컬 상태에 반영한다. HA는 부르지 않는다.
 */
import { actionsOf, type DeviceActionRequest } from "@howling/contracts";
import type Database from "better-sqlite3";
import type { HaEvent } from "../ha/client.js";
import { writeDeviceState } from "./next-state.js";
import { getDevice } from "./store.js";

export const applyVirtualAction = (
  db: Database.Database,
  request: DeviceActionRequest,
): HaEvent | undefined => {
  const row = getDevice(db, request.deviceId);
  if (!row || row.origin !== "virtual" || !row.available) {
    return undefined;
  }
  if (!actionsOf(row.kind).includes(request.action)) {
    return undefined;
  }
  const mapped = writeDeviceState(db, row, request.action, request.data ?? {});
  return {
    entityId: mapped.entityId,
    state: mapped.state,
    previous: row.state,
    attrs: mapped.attrs,
    previousAttrs: row.attrs,
  };
};
