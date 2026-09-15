/**
 * Hue 연결을 runtime에 넘긴다. entity_id는 없다.
 */
import { randomUUID } from "node:crypto";
import {
  deviceIntegrateBodySchema,
  deviceIntegrateResultSchema,
  errorBody,
  errorCodes,
  type DeviceIntegrateBody,
  type DeviceIntegrateResult,
} from "@howling/contracts";
import type pg from "pg";
import { denied, type Actor, type ServiceResult } from "../flows/access.js";
import { runtimeBySite, sendToRuntime } from "../runtime/hub.js";
import { upsertSiteDevice } from "./store.js";

const pending = new Map<
  string,
  {
    readonly resolve: (value: DeviceIntegrateResult) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }
>();

export const acceptDeviceIntegrated = (payload: unknown): void => {
  const parsed = deviceIntegrateResultSchema.safeParse(payload);
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

export const integrateDeviceFor = async (
  pool: pg.Pool,
  actor: Actor,
  body: unknown,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit");
  if (scope) {
    return scope;
  }
  return integrateSiteDevice(pool, actor.siteId, body);
};

export const integrateSiteDevice = async (
  pool: pg.Pool,
  siteId: string,
  body: unknown,
): Promise<ServiceResult> => {
  const parsed = deviceIntegrateBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: errorBody(errorCodes.invalidRequest, "연결할 기기를 고르세요."),
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
  const result = await waitForIntegrated(siteId, { requestId, ...parsed.data }, parsed.data.list ? 8_000 : 25_000);
  if (result.status === "error" || result.error === "offline") {
    const offline = result.error === "offline";
    return {
      ok: false,
      status: 409,
      body: errorBody(
        offline ? errorCodes.runtimeOffline : errorCodes.conflict,
        offline ? "runtime offline" : (result.error ?? "기기를 연결하지 못했습니다."),
      ),
    };
  }
  for (const device of result.devices ?? []) {
    await upsertSiteDevice(pool, siteId, device);
  }
  return {
    ok: true,
    status: 200,
    body: {
      status: result.status,
      ...(result.token ? { token: result.token } : {}),
      ...(result.title ? { title: result.title } : {}),
      ...(result.description ? { description: result.description } : {}),
      ...(result.submitLabel ? { submitLabel: result.submitLabel } : {}),
      ...(result.fields ? { fields: result.fields } : {}),
      ...(result.options ? { options: result.options } : {}),
      ...(result.devices ? { devices: result.devices } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
  };
};

const waitForIntegrated = (
  siteId: string,
  payload: DeviceIntegrateBody & { readonly requestId: string },
  timeoutMs: number,
): Promise<DeviceIntegrateResult> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, status: "error", error: "offline" });
    }, timeoutMs);
    pending.set(payload.requestId, { resolve, timer });
    if (!sendToRuntime(siteId, "devices.integrate", payload)) {
      clearTimeout(timer);
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, status: "error", error: "offline" });
    }
  });
