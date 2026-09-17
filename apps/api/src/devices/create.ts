/**
 * 기기 생성을 runtime에 넘기고 결과만 받는다. entity_id는 없다.
 */
import { randomUUID } from "node:crypto";
import {
  deviceCreateBodySchema,
  deviceCreateResultSchema,
  errorBody,
  errorCodes,
  type DeviceCreateBody,
  type DeviceCreateResult,
} from "@howling/contracts";
import type pg from "pg";
import { denied, type Actor, type ServiceResult } from "../flows/access.js";
import { runtimeBySite, sendToRuntime } from "../runtime/hub.js";
import { upsertSiteDevice } from "./store.js";

const pending = new Map<
  string,
  {
    readonly resolve: (value: DeviceCreateResult) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();

export const acceptDeviceCreated = (payload: unknown): void => {
  const parsed = deviceCreateResultSchema.safeParse(payload);
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

export const createDeviceFor = async (
  pool: pg.Pool,
  actor: Actor,
  body: unknown,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit");
  if (scope) {
    return scope;
  }
  return createSiteDevice(pool, actor.siteId, body);
};

export const createSiteDevice = async (
  pool: pg.Pool,
  siteId: string,
  body: unknown,
): Promise<ServiceResult> => {
  const parsed = deviceCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: errorBody(errorCodes.invalidRequest, "이름과 종류 또는 필드가 필요합니다."),
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
  const result = await waitForCreated(siteId, { requestId, ...parsed.data });
  const devices = result.devices ?? (result.device ? [result.device] : []);
  if (result.error || devices.length === 0) {
    const offline = result.error === "offline";
    return {
      ok: false,
      status: 409,
      body: errorBody(
        offline ? errorCodes.runtimeOffline : errorCodes.conflict,
        offline ? "runtime offline" : (result.error ?? "기기를 만들지 못했습니다."),
      ),
    };
  }
  for (const device of devices) {
    await upsertSiteDevice(pool, siteId, device);
  }
  return { ok: true, status: 200, body: { device: devices[0], devices } };
};

const waitForCreated = (
  siteId: string,
  payload: DeviceCreateBody & { readonly requestId: string },
): Promise<DeviceCreateResult> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }, 8000);
    pending.set(payload.requestId, { resolve, timer });
    if (!sendToRuntime(siteId, "devices.create", payload)) {
      clearTimeout(timer);
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, error: "offline" });
    }
  });
