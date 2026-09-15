/**
 * 보관 정책·관측·차트·원본 상세 HTTP.
 */
import type { AnalyticsSnapshot, ObservationSpec, SiteDataPolicy } from "@howling/contracts";
import { UnauthorizedError } from "./api.js";

const ask = async <T>(
  url: string,
  init: RequestInit & { readonly csrf?: string } = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.csrf) {
    headers.set("x-csrf-token", init.csrf);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(url, { credentials: "same-origin", ...init, headers });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} ${String(response.status)} ${text}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
};

export const getDataPolicy = (siteId: string) =>
  ask<{ policy: SiteDataPolicy; lastSyncAt: string | null }>(
    `/api/v1/sites/${siteId}/data-policy`,
  );

export const putDataPolicy = (siteId: string, csrf: string, policy: SiteDataPolicy) =>
  ask<{ policy: SiteDataPolicy }>(`/api/v1/sites/${siteId}/data-policy`, {
    method: "PUT",
    csrf,
    body: JSON.stringify(policy),
  });

export const purgeCloudRaw = (siteId: string, csrf: string) =>
  ask<{ ok: true; removed: number }>(`/api/v1/sites/${siteId}/data-policy/purge`, {
    method: "POST",
    csrf,
    body: "{}",
  });

export const getObservations = (siteId: string) =>
  ask<{ observations: ObservationSpec }>(`/api/v1/sites/${siteId}/observations`);

export const putObservations = (siteId: string, csrf: string, observations: ObservationSpec) =>
  ask<{ observations: ObservationSpec }>(`/api/v1/sites/${siteId}/observations`, {
    method: "PUT",
    csrf,
    body: JSON.stringify(observations),
  });

export const getAnalytics = (siteId: string) =>
  ask<AnalyticsSnapshot>(`/api/v1/sites/${siteId}/analytics`);

export const requestRunDetail = (
  siteId: string,
  runId: string,
  csrf: string,
  body: { readonly nodeId?: string; readonly field?: string },
) =>
  ask<{ value?: unknown; unavailable?: string }>(
    `/api/v1/sites/${siteId}/runs/${runId}/detail-requests`,
    { method: "POST", csrf, body: JSON.stringify(body) },
  );
