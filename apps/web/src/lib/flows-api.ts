/**
 * Flow·pairing·run HTTP. CSRF를 붙인다.
 */
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
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers,
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(`${url} ${String(response.status)}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

export const pairRuntime = (
  siteId: string,
  code: string,
  csrf: string,
): Promise<{ pairingId: string; runtimeId: string }> =>
  ask(`/api/v1/sites/${siteId}/runtime/pair`, {
    method: "POST",
    csrf,
    body: JSON.stringify({ code }),
  });

export const listFlows = (siteId: string) =>
  ask<{ flows: FlowListItem[] }>(`/api/v1/sites/${siteId}/flows`);

export const createFlow = (siteId: string, name: string, csrf: string) =>
  ask<{ flowId: string }>(`/api/v1/sites/${siteId}/flows`, {
    method: "POST",
    csrf,
    body: JSON.stringify({ name }),
  });

export const getFlow = (siteId: string, flowId: string) =>
  ask<FlowDetail>(`/api/v1/sites/${siteId}/flows/${flowId}`);

export const saveDraft = (
  siteId: string,
  flowId: string,
  csrf: string,
  body: {
    readonly expectedVersion: number;
    readonly definition: unknown;
    readonly triggers: unknown;
    readonly connections: unknown;
  },
) =>
  ask<{ ok: true }>(`/api/v1/sites/${siteId}/flows/${flowId}/draft`, {
    method: "PUT",
    csrf,
    body: JSON.stringify(body),
  });

export const saveEditor = (
  siteId: string,
  flowId: string,
  csrf: string,
  body: {
    readonly expectedVersion: number;
    readonly positions: Record<string, { x: number; y: number }>;
    readonly viewport: { x: number; y: number; zoom: number };
  },
) =>
  ask<{ ok: true }>(`/api/v1/sites/${siteId}/flows/${flowId}/editor`, {
    method: "PUT",
    csrf,
    body: JSON.stringify(body),
  });

export const validateFlow = (siteId: string, flowId: string, csrf: string, definition: unknown) =>
  ask<{ ok: boolean; diagnostics?: { message: string }[] }>(
    `/api/v1/sites/${siteId}/flows/${flowId}/validate`,
    { method: "POST", csrf, body: JSON.stringify({ definition }) },
  );

export const createRevision = (siteId: string, flowId: string, csrf: string) =>
  ask<{ revisionId: string; digest: string }>(
    `/api/v1/sites/${siteId}/flows/${flowId}/revisions`,
    { method: "POST", csrf, body: "{}" },
  );

export const deployRevision = (
  siteId: string,
  flowId: string,
  csrf: string,
  revisionId: string,
) =>
  ask<{ deploymentId: string; generation: number }>(
    `/api/v1/sites/${siteId}/flows/${flowId}/deployments`,
    { method: "POST", csrf, body: JSON.stringify({ revisionId }) },
  );

export const getDeployment = (siteId: string, deploymentId: string) =>
  ask<{ status: string; revision_id: string; generation: number }>(
    `/api/v1/sites/${siteId}/deployments/${deploymentId}`,
  );

export const listRuns = (siteId: string, flowId?: string) =>
  ask<{ runs: RunRow[] }>(
    `/api/v1/sites/${siteId}/runs${flowId ? `?flowId=${flowId}` : ""}`,
  );

export const getRun = (siteId: string, runId: string) =>
  ask<RunRow>(`/api/v1/sites/${siteId}/runs/${runId}`);

export interface FlowListItem {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly revision_id: string | null;
  readonly deploy_status: string | null;
}

export interface FlowDetail {
  readonly flowId: string;
  readonly name: string;
  readonly draft: {
    readonly version: number;
    readonly definition: unknown;
    readonly triggers: unknown;
    readonly connections: unknown;
  };
  readonly editor: {
    readonly version: number;
    readonly positions: Record<string, { x: number; y: number }>;
    readonly viewport: { x: number; y: number; zoom: number };
  };
  readonly deployment: {
    readonly id: string;
    readonly revisionId: string;
    readonly status: string;
    readonly generation: number;
  } | null;
}

export interface RunRow {
  readonly runId: string;
  readonly flowId: string;
  readonly revisionId: string;
  readonly status: string;
  readonly lastSeq: number;
  readonly trigger: unknown;
  readonly events: readonly { sequence: number; type: string; nodeId?: string }[];
}
