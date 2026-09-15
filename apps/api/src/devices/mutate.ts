/**
 * 기기 이름 변경·삭제를 runtime에 넘긴다. entity_id는 없다.
 */
import { randomUUID } from "node:crypto";
import {
  deviceDeleteResultSchema,
  deviceUpdateBodySchema,
  deviceUpdateResultSchema,
  errorBody,
  errorCodes,
  type DeviceDeleteResult,
  type DeviceUpdateResult,
} from "@howling/contracts";
import type pg from "pg";
import { denied, type Actor, type ServiceResult } from "../flows/access.js";
import { runtimeBySite, sendToRuntime } from "../runtime/hub.js";
import { deleteSiteDevice, upsertSiteDevice } from "./store.js";

const pendingUpdate = new Map<
  string,
  {
    readonly resolve: (value: DeviceUpdateResult) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();

const pendingDelete = new Map<
  string,
  {
    readonly resolve: (value: DeviceDeleteResult) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();

export const acceptDeviceUpdated = (payload: unknown): void => {
  const parsed = deviceUpdateResultSchema.safeParse(payload);
  if (!parsed.success) {
    return;
  }
  const wait = pendingUpdate.get(parsed.data.requestId);
  if (!wait) {
    return;
  }
  clearTimeout(wait.timer);
  pendingUpdate.delete(parsed.data.requestId);
  wait.resolve(parsed.data);
};

export const acceptDeviceDeleted = (payload: unknown): void => {
  const parsed = deviceDeleteResultSchema.safeParse(payload);
  if (!parsed.success) {
    return;
  }
  const wait = pendingDelete.get(parsed.data.requestId);
  if (!wait) {
    return;
  }
  clearTimeout(wait.timer);
  pendingDelete.delete(parsed.data.requestId);
  wait.resolve(parsed.data);
};

export const updateDeviceFor = async (
  pool: pg.Pool,
  actor: Actor,
  deviceId: string,
  body: unknown,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit");
  if (scope) {
    return scope;
  }
  return updateSiteDevice(pool, actor.siteId, deviceId, body);
};

export const deleteDeviceFor = async (
  pool: pg.Pool,
  actor: Actor,
  deviceId: string,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit");
  if (scope) {
    return scope;
  }
  return removeSiteDevice(pool, actor.siteId, deviceId);
};

export const updateSiteDevice = async (
  pool: pg.Pool,
  siteId: string,
  deviceId: string,
  body: unknown,
): Promise<ServiceResult> => {
  const parsed = deviceUpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: errorBody(errorCodes.invalidRequest, "이름이 필요합니다."),
    };
  }
  if (!runtimeBySite(siteId)) {
    return offline();
  }
  const requestId = randomUUID();
  const result = await waitForUpdated(siteId, { requestId, deviceId, name: parsed.data.name });
  if (result.error || !result.device) {
    return failed(result.error, "이름을 바꾸지 못했습니다.");
  }
  await upsertSiteDevice(pool, siteId, result.device);
  return { ok: true, status: 200, body: { device: result.device } };
};

export const removeSiteDevice = async (
  pool: pg.Pool,
  siteId: string,
  deviceId: string,
): Promise<ServiceResult> => {
  if (!runtimeBySite(siteId)) {
    return offline();
  }
  const requestId = randomUUID();
  const result = await waitForDeleted(siteId, { requestId, deviceId });
  if (result.error || !result.deviceId) {
    return failed(result.error, "기기를 지우지 못했습니다.");
  }
  await deleteSiteDevice(pool, siteId, result.deviceId);
  return { ok: true, status: 200, body: { deviceId: result.deviceId } };
};

const offline = (): ServiceResult => ({
  ok: false,
  status: 409,
  body: errorBody(errorCodes.runtimeOffline, "runtime offline"),
});

const failed = (error: string | undefined, fallback: string): ServiceResult => {
  const offlineNow = error === "offline";
  return {
    ok: false,
    status: offlineNow ? 409 : error === "기기를 찾지 못했습니다." ? 404 : 409,
    body: errorBody(
      offlineNow ? errorCodes.runtimeOffline : error === "기기를 찾지 못했습니다." ? errorCodes.notFound : errorCodes.conflict,
      offlineNow ? "runtime offline" : (error ?? fallback),
    ),
  };
};

const waitForUpdated = (
  siteId: string,
  payload: { readonly requestId: string; readonly deviceId: string; readonly name: string },
): Promise<DeviceUpdateResult> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingUpdate.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }, 8000);
    pendingUpdate.set(payload.requestId, { resolve, timer });
    if (!sendToRuntime(siteId, "devices.update", payload)) {
      clearTimeout(timer);
      pendingUpdate.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }
  });

const waitForDeleted = (
  siteId: string,
  payload: { readonly requestId: string; readonly deviceId: string },
): Promise<DeviceDeleteResult> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingDelete.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }, 8000);
    pendingDelete.set(payload.requestId, { resolve, timer });
    if (!sendToRuntime(siteId, "devices.delete", payload)) {
      clearTimeout(timer);
      pendingDelete.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }
  });
