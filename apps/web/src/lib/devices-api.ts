/**
 * 기기 목록·추가. entity_id는 응답에 없다.
 */
import type {
  DeviceActionBody,
  DeviceCreateBody,
  DeviceIntegrateBody,
  DeviceIntegrateResult,
  DeviceSummary,
} from "@howling/contracts";
import { UnauthorizedError } from "./api.js";

const readError = async (response: Response): Promise<string> => {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
};

export const getDevices = async (siteId: string): Promise<{ devices: DeviceSummary[] }> => {
  const response = await fetch(`/api/v1/sites/${siteId}/devices`, { credentials: "same-origin" });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : { devices: [] }) as { devices: DeviceSummary[] };
};

export const createDevice = async (
  siteId: string,
  csrf: string,
  body: DeviceCreateBody,
): Promise<DeviceSummary[]> => {
  const response = await fetch(`/api/v1/sites/${siteId}/devices`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const parsed = (await response.json()) as { device?: DeviceSummary; devices?: DeviceSummary[] };
  return parsed.devices ?? (parsed.device ? [parsed.device] : []);
};

export const actDevice = async (
  siteId: string,
  csrf: string,
  deviceId: string,
  body: DeviceActionBody,
): Promise<DeviceSummary> => {
  const response = await fetch(`/api/v1/sites/${siteId}/devices/${deviceId}/actions`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const parsed = (await response.json()) as { device: DeviceSummary };
  return parsed.device;
};

export const integrateDevice = async (
  siteId: string,
  csrf: string,
  body: DeviceIntegrateBody,
): Promise<Omit<DeviceIntegrateResult, "requestId">> => {
  const response = await fetch(`/api/v1/sites/${siteId}/devices/integrations`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as Omit<DeviceIntegrateResult, "requestId">;
};
