/**
 * 기기 목록. entity_id는 응답에 없다.
 */
import type { DeviceSummary } from "@howling/contracts";
import { UnauthorizedError } from "./api.js";

export const getDevices = async (siteId: string): Promise<{ devices: DeviceSummary[] }> => {
  const response = await fetch(`/api/v1/sites/${siteId}/devices`, { credentials: "same-origin" });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${text}`);
  }
  return (text ? JSON.parse(text) : { devices: [] }) as { devices: DeviceSummary[] };
};
