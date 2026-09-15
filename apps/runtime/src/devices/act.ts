/**
 * 대시보드 동작을 실행한다. entity_id는 응답에 없다.
 */
import {
  actionsOf,
  deviceActionInvokeSchema,
  type DeviceActionInvoke,
  type DeviceActionResult,
  type DeviceSummary,
} from "@howling/contracts";
import type Database from "better-sqlite3";
import type { HaEvent } from "../ha/client.js";
import type { HaHandle } from "../ha/client.js";
import { writeDeviceState } from "./next-state.js";
import { resolveAction } from "./resolve.js";
import { getDevice, summariesOf } from "./store.js";
import { applyVirtualAction } from "./virtual-apply.js";

export const handleDevicesAction = async (
  input: {
    readonly db: Database.Database;
    readonly ha?: HaHandle;
    readonly onEvent?: (event: HaEvent) => void;
  },
  payload: DeviceActionInvoke,
): Promise<DeviceActionResult> => {
  const parsed = deviceActionInvokeSchema.safeParse(payload);
  if (!parsed.success) {
    return { requestId: payload.requestId, error: "동작이 올바르지 않습니다." };
  }
  const row = getDevice(input.db, parsed.data.deviceId);
  if (!row || !row.available) {
    return { requestId: parsed.data.requestId, error: "기기를 쓸 수 없습니다." };
  }
  if (!actionsOf(row.kind).includes(parsed.data.action)) {
    return { requestId: parsed.data.requestId, error: "이 동작은 없습니다." };
  }
  if (row.origin === "virtual") {
    const event = applyVirtualAction(input.db, parsed.data);
    if (!event) {
      return { requestId: parsed.data.requestId, error: "기기를 바꾸지 못했습니다." };
    }
    input.onEvent?.(event);
    return { requestId: parsed.data.requestId, ...(summaryOf(input.db, row.id) ?? {}) };
  }
  const resolved = resolveAction(input.db, parsed.data.deviceId, parsed.data.action, parsed.data.data);
  if (!resolved || !input.ha) {
    return { requestId: parsed.data.requestId, error: "허브가 없습니다." };
  }
  try {
    await input.ha.callService(resolved.domain, resolved.service, resolved.service_data);
  } catch {
    return { requestId: parsed.data.requestId, error: "허브가 동작을 거절했습니다." };
  }
  writeDeviceState(input.db, row, parsed.data.action, parsed.data.data ?? {});
  return { requestId: parsed.data.requestId, ...(summaryOf(input.db, row.id) ?? {}) };
};

const summaryOf = (
  db: Database.Database,
  id: string,
): { device: DeviceSummary } | undefined => {
  const row = getDevice(db, id);
  const device = row ? summariesOf([row])[0] : undefined;
  return device ? { device } : undefined;
};
