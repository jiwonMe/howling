/**
 * 활성 배포를 끈다. 새 generation으로 늦은 activate를 막는다.
 */
import { errorBody, errorCodes } from "@howling/contracts";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { getFlow, getRevision, insertDeployment } from "./store.js";

export const deactivateFlow = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
): Promise<ServiceResult> => {
  const scope = denied(actor, "deploy") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  const flow = await getFlow(pool, actor.siteId, flowId);
  if (!flow) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "flow not found") };
  }
  const revisionId = flow.deployment?.revision_id;
  if (!revisionId || flow.deployment?.status !== "active") {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.invalidRequest, "no active deployment"),
    };
  }
  return requestDeactivate(pool, actor.siteId, flowId, revisionId);
};

export const requestDeactivate = async (
  pool: pg.Pool,
  siteId: string,
  flowId: string,
  revisionId: string,
): Promise<ServiceResult> => {
  const artifact = await getRevision(pool, revisionId);
  if (!artifact) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "revision not found") };
  }
  const created = await insertDeployment(pool, {
    siteId,
    flowId,
    revisionId,
  });
  const sent = sendToRuntime(siteId, "desired.deployment", {
    deploymentId: created.id,
    generation: created.generation,
    artifact,
    deactivate: true,
  });
  if (!sent) {
    await pool.query(`DELETE FROM deployments WHERE id = $1`, [created.id]);
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
