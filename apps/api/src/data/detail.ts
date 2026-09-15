/**
 * 일회성 원본 조회. 응답 payload는 DB·로그에 남기지 않는다.
 */
import { randomUUID } from "node:crypto";
import {
  detailResponseSchema,
  errorBody,
  errorCodes,
  type DetailResponse,
} from "@howling/contracts";
import type pg from "pg";
import { denied, type Actor, type ServiceResult } from "../flows/access.js";
import { getRun } from "../flows/runs.js";
import { runtimeBySite, sendToRuntime } from "../runtime/hub.js";
import { insertDetailAudit } from "./store.js";

const pending = new Map<
  string,
  { readonly resolve: (value: DetailResponse) => void; readonly timer: ReturnType<typeof setTimeout> }
>();

export const acceptDetailResponse = (payload: unknown): void => {
  const parsed = detailResponseSchema.safeParse(payload);
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

export const requestRunDetail = async (
  pool: pg.Pool,
  actor: Actor,
  runId: string,
  body: { readonly nodeId?: string; readonly field?: string; readonly sequence?: number },
): Promise<ServiceResult> => {
  const scope = denied(actor, "data.read");
  if (scope) {
    return scope;
  }
  const row = await getRun(pool, actor.siteId, runId);
  if (!row || (actor.flowId && row.flow_id !== actor.flowId)) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "run not found") };
  }
  await insertDetailAudit(pool, {
    siteId: actor.siteId,
    runId,
    ...(body.nodeId ? { nodeId: body.nodeId } : {}),
    ...(body.field ? { field: body.field } : {}),
  });
  const requestId = randomUUID();
  const online = Boolean(runtimeBySite(actor.siteId));
  if (!online) {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.rawUnavailable, "runtime offline"),
    };
  }
  const response = await waitForDetail(actor.siteId, {
    requestId,
    runId,
    ...(body.nodeId ? { nodeId: body.nodeId } : {}),
    ...(body.field ? { field: body.field } : {}),
    ...(body.sequence !== undefined ? { sequence: body.sequence } : {}),
  });
  if (response.unavailable) {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.rawUnavailable, response.unavailable),
    };
  }
  return { ok: true, status: 200, body: response };
};

const waitForDetail = (
  siteId: string,
  payload: {
    readonly requestId: string;
    readonly runId: string;
    readonly nodeId?: string;
    readonly field?: string;
    readonly sequence?: number;
  },
): Promise<DetailResponse> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, runId: payload.runId, unavailable: "offline" });
    }, 4000);
    pending.set(payload.requestId, { resolve, timer });
    if (!sendToRuntime(siteId, "detail.request", payload)) {
      clearTimeout(timer);
      pending.delete(payload.requestId);
      resolve({ requestId: payload.requestId, runId: payload.runId, unavailable: "offline" });
    }
  });
