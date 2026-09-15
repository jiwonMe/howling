/**
 * Revision을 runtime desired.deployment로 보낸다.
 */
import {
  errorBody,
  errorCodes,
  type DeployRequest,
} from "@howling/contracts";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { getFlow, getRevision, insertDeployment } from "./store.js";

export const deployRevision = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
  request: DeployRequest,
): Promise<ServiceResult> => {
  const scope = denied(actor, "deploy") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  const flow = await getFlow(pool, actor.siteId, flowId);
  if (
    request.stateEpoch === "keep" &&
    flow?.deployment?.revision_id !== request.revisionId
  ) {
    return {
      ok: false,
      status: 400,
      body: errorBody(errorCodes.invalidRequest, "keep is only valid for the same revision"),
    };
  }
  const artifact = await getRevision(pool, request.revisionId);
  if (!artifact || artifact.siteId !== actor.siteId || artifact.flowId !== flowId) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "revision not found") };
  }
  const created = await insertDeployment(pool, {
    siteId: actor.siteId,
    flowId,
    revisionId: request.revisionId,
  });
  const sent = sendToRuntime(actor.siteId, "desired.deployment", {
    deploymentId: created.id,
    generation: created.generation,
    artifact,
    rollback: request.rollback,
    stateEpoch: request.stateEpoch ?? "reset",
  });
  if (!sent) {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.runtimeOffline, "runtime offline"),
    };
  }
  return {
    ok: true,
    status: 202,
    body: { deploymentId: created.id, generation: created.generation },
  };
};
