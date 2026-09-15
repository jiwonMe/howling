/**
 * 활성 배포 플로만 live 실행한다.
 */
import { errorBody, errorCodes } from "@howling/contracts";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { getFlow } from "./store.js";

export type LiveRunRequest = {
  readonly input?: unknown;
  readonly mode: "auto" | "manual";
  readonly idempotencyKey: string;
};

export const startLiveRun = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
  request: LiveRunRequest,
): Promise<ServiceResult> => {
  const scope = denied(actor, "run") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  const flow = await getFlow(pool, actor.siteId, flowId);
  const revisionId = flow?.deployment?.revision_id;
  if (!revisionId || flow?.deployment?.status !== "active") {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.invalidRequest, "no active deployment"),
    };
  }
  const sent = sendToRuntime(actor.siteId, "run.start", {
    artifactId: revisionId,
    flowId,
    input: request.input,
    mode: request.mode,
    idempotencyKey: request.idempotencyKey,
  });
  if (!sent) {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.runtimeOffline, "runtime offline"),
    };
  }
  return { ok: true, status: 202, body: { accepted: true } };
};
