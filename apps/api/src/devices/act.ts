/**
 * 대시보드 동작을 runtime에 넘긴다. entity_id는 없다.
 */
import { randomUUID } from "node:crypto";
import {
  deviceActionBodySchema,
  deviceActionResultSchema,
  errorBody,
  errorCodes,
  type DeviceActionResult,
} from "@howling/contracts";
import type pg from "pg";
import { runtimeBySite, sendToRuntime } from "../runtime/hub.js";
import { upsertSiteDevice } from "./store.js";

const pending = new Map<
  string,
  {
    readonly resolve: (value: DeviceActionResult) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();

export const acceptDeviceActed = (payload: unknown): void => {
  const parsed = deviceActionResultSchema.safeParse(payload);
  if (!parsed.success) {
    return;
  }
  const wait = pending.get(parsed.data.requestId);
  if (!wait) {
    return;
  }
  clearTimeout(wait.timer);
  pending.delete(parsed.data.requestId);
  wait.resolve(parsed.data);
};

export const actSiteDevice = async (
  pool: pg.Pool,
  siteId: string,
  deviceId: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> => {
  const parsed = deviceActionBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: errorBody(errorCodes.invalidRequest, "동작이 필요합니다."),
    };
  }
  if (!runtimeBySite(siteId)) {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.runtimeOffline, "runtime offline"),
    };
  }
  const requestId = randomUUID();
  const result = await waitForActed(siteId, {
    requestId,
    deviceId,
    action: parsed.data.action,
    ...(parsed.data.data ? { data: parsed.data.data } : {}),
  });
  if (result.error || !result.device) {
    const offline = result.error === "offline";
    return {
      ok: false,
      status: 409,
      body: errorBody(
        offline ? errorCodes.runtimeOffline : errorCodes.conflict,
        offline ? "runtime offline" : (result.error ?? "기기를 바꾸지 못했습니다."),
      ),
    };
  }
  await upsertSiteDevice(pool, siteId, result.device);
  return { ok: true, status: 200, body: { device: result.device } };
};

const waitForActed = (
  siteId: string,
  payload: {
    readonly requestId: string;
    readonly deviceId: string;
    readonly action: string;
    readonly data?: Record<string, string | number | boolean>;
  },
): Promise<DeviceActionResult> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }, 8000);
    pending.set(payload.requestId, { resolve, timer });
    if (!sendToRuntime(siteId, "devices.action", payload)) {
      clearTimeout(timer);
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }
  });
