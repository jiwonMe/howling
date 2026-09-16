/**
 * Flow·pairing·run HTTP. CSRF를 붙인다.
 */
import { UnauthorizedError } from "./api.js";
import type { FlowDetail, FlowListItem, RunRow, TokenRow } from "./flow-types.js";

export type { FlowDetail, FlowListItem, RunRow, TokenRow };

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
    const text = await response.text();
    throw new Error(`${url} ${String(response.status)} ${text}`);
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

export const renameFlow = (siteId: string, flowId: string, csrf: string, name: string) =>
  ask<{ flowId: string; name: string }>(`/api/v1/sites/${siteId}/flows/${flowId}`, {
    method: "PATCH",
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
    readonly executionPolicy?: { readonly mode: "live" | "dry-run"; readonly captureRaw: boolean };
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
  options: { readonly rollback?: boolean; readonly stateEpoch?: "reset" | "keep" } = {},
) =>
  ask<{ deploymentId: string; generation: number }>(
    `/api/v1/sites/${siteId}/flows/${flowId}/deployments`,
    {
      method: "POST",
      csrf,
      body: JSON.stringify({
        revisionId,
        rollback: options.rollback,
        stateEpoch: options.stateEpoch ?? "reset",
      }),
    },
  );

export const startTestSession = (
  siteId: string,
  flowId: string,
  csrf: string,
  body: {
    readonly source: "draft" | "revision" | "run";
    readonly revisionId?: string;
    readonly runId?: string;
    readonly input: unknown;
    readonly fixtures: unknown[];
    readonly progression?: "auto" | "manual";
    readonly initialState?: Record<string, unknown>;
    readonly idempotencyKey: string;
  },
) =>
  ask<{ accepted: true; runId: string; testSessionId: string }>(
    `/api/v1/sites/${siteId}/flows/${flowId}/test-sessions`,
    { method: "POST", csrf, body: JSON.stringify(body) },
  );

export const postRunCommand = (
  siteId: string,
  runId: string,
  csrf: string,
  body: {
    readonly type: "step" | "continue" | "pause" | "resume" | "cancel" | "fixture";
    readonly commandId: string;
    readonly effectId?: string;
    readonly response?: unknown;
  },
) =>
  ask<{ accepted: boolean }>(`/api/v1/sites/${siteId}/runs/${runId}/commands`, {
    method: "POST",
    csrf,
    body: JSON.stringify(body),
  });

export const getRunEvents = (siteId: string, runId: string, after = 0) =>
  ask<RunRow & { cursor: number; journal: { syncSeq: number; item: unknown }[] }>(
    `/api/v1/sites/${siteId}/runs/${runId}/events?after=${String(after)}`,
  );

export const getDeployment = (siteId: string, deploymentId: string) =>
  ask<{ status: string; revision_id: string; generation: number }>(
    `/api/v1/sites/${siteId}/deployments/${deploymentId}`,
  );

export const deactivateFlow = (siteId: string, flowId: string, csrf: string) =>
  ask<{ deploymentId: string; generation: number }>(
    `/api/v1/sites/${siteId}/flows/${flowId}/deactivate`,
    { method: "POST", csrf, body: "{}" },
  );

export const deleteFlow = (siteId: string, flowId: string, csrf: string) =>
  ask<{ ok: true }>(`/api/v1/sites/${siteId}/flows/${flowId}`, {
    method: "DELETE",
    csrf,
  });

export const waitDeployment = async (
  siteId: string,
  deploymentId: string,
): Promise<{ status: string; revision_id: string; generation: number }> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const row = await getDeployment(siteId, deploymentId);
    if (row.status === "active" || row.status === "failed" || row.status === "inactive") {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("deployment wait timeout");
};

export const listRuns = (siteId: string, flowId?: string) =>
  ask<{ runs: RunRow[] }>(
    `/api/v1/sites/${siteId}/runs${flowId ? `?flowId=${flowId}` : ""}`,
  );

export const getRun = (siteId: string, runId: string) =>
  ask<RunRow>(`/api/v1/sites/${siteId}/runs/${runId}`);

export const startLiveRun = (
  siteId: string,
  flowId: string,
  csrf: string,
  input: unknown,
) =>
  ask<{ accepted: true }>(`/api/v1/sites/${siteId}/flows/${flowId}/runs`, {
    method: "POST",
    csrf,
    body: JSON.stringify({
      input,
      mode: "auto",
      idempotencyKey: `live-${Date.now()}`,
    }),
  });

export const getConnections = (siteId: string) =>
  ask<{
    connections: {
      ha?: { status?: string };
      mcp?: {
        status: string;
        servers: {
          id: string;
          name: string;
          status: string;
          tools: { connectionId: string; tool: string; inputSchemaDigest: string; title?: string }[];
        }[];
      };
    };
  }>(`/api/v1/sites/${siteId}/connections`);

export const listTokens = (siteId: string) =>
  ask<{ tokens: TokenRow[] }>(`/api/v1/sites/${siteId}/tokens`);

export const issueToken = (
  siteId: string,
  csrf: string,
  body: { readonly name: string; readonly scopes: readonly string[]; readonly flowId?: string },
) =>
  ask<{ id: string; token: string }>(`/api/v1/sites/${siteId}/tokens`, {
    method: "POST",
    csrf,
    body: JSON.stringify(body),
  });

export const revokeToken = (siteId: string, csrf: string, tokenId: string) =>
  ask<{ ok: true }>(`/api/v1/sites/${siteId}/tokens/${tokenId}`, {
    method: "DELETE",
    csrf,
  });

