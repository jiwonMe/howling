/**
 * 기기 이름 변경·삭제. entity_id는 runtime에만 둔다.
 */
import type {
  DeviceDeleteRequest,
  DeviceDeleteResult,
  DeviceUpdateRequest,
  DeviceUpdateResult,
} from "@howling/contracts";
import { looksLikeEntityId } from "@howling/contracts";
import type Database from "better-sqlite3";
import type { HaHandle } from "../ha/client.js";
import { domainOf, helperItemIdOf } from "./classify.js";
import { getDevice, isHelperEntity, removeDevice, renameDevice, summariesOf } from "./store.js";

export const handleDevicesUpdate = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
  },
  payload: DeviceUpdateRequest,
): Promise<DeviceUpdateResult> => {
  if (looksLikeEntityId(payload.name)) {
    return { requestId: payload.requestId, error: "entity id는 넣을 수 없습니다." };
  }
  const row = getDevice(input.db, payload.deviceId);
  if (!row) {
    return { requestId: payload.requestId, error: "기기를 찾지 못했습니다." };
  }
  if (row.origin === "ha") {
    if (!input.ha || input.ha.status() !== "ready") {
      return { requestId: payload.requestId, error: "허브가 아직 준비되지 않았습니다." };
    }
    try {
      await input.ha.request("config/entity_registry/update", {
        entity_id: row.entityId,
        name: payload.name,
      });
    } catch (error) {
      return { requestId: payload.requestId, error: publicMutateError(error, "이름을 바꾸지 못했습니다.") };
    }
  }
  const next = renameDevice(input.db, row.id, payload.name);
  const device = next ? summariesOf([next])[0] : undefined;
  if (!device) {
    return { requestId: payload.requestId, error: "이름을 바꾸지 못했습니다." };
  }
  return { requestId: payload.requestId, device };
};

export const handleDevicesDelete = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
  },
  payload: DeviceDeleteRequest,
): Promise<DeviceDeleteResult> => {
  const row = getDevice(input.db, payload.deviceId);
  if (!row) {
    return { requestId: payload.requestId, error: "기기를 찾지 못했습니다." };
  }
  if (row.origin === "ha" && !isHelperEntity(row.entityId)) {
    return { requestId: payload.requestId, deviceId: row.id, error: "집 기기는 허브에서 빼야 합니다." };
  }
  if (row.origin === "ha") {
    if (!input.ha || input.ha.status() !== "ready") {
      return { requestId: payload.requestId, error: "허브가 아직 준비되지 않았습니다." };
    }
    try {
      const domain = domainOf(row.entityId);
      await input.ha.request(`${domain}/delete`, { [`${domain}_id`]: helperItemIdOf(row.entityId) });
    } catch (error) {
      return { requestId: payload.requestId, error: publicMutateError(error, "기기를 지우지 못했습니다.") };
    }
  }
  removeDevice(input.db, row.id);
  return { requestId: payload.requestId, deviceId: row.id };
};

export const publicMutateError = (error: unknown, fallback: string): string => {
  const raw = error instanceof Error ? error.message : "";
  if (/timeout|disconnected|not ready/i.test(raw)) {
    return "허브에 닿지 못했습니다.";
  }
  if (/unable to find|not found|itemnotfound/i.test(raw)) {
    return "허브 설정에 있는 기기는 여기서 지울 수 없습니다.";
  }
  return fallback;
};
