/**
 * 초안을 지운다. 활성이면 runtime 포인터를 먼저 끈다.
 */
import { errorBody, errorCodes } from "@howling/contracts";
import type pg from "pg";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { requestDeactivate } from "./deactivate.js";
import { getFlow } from "./store.js";

export const deleteFlow = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  const flow = await getFlow(pool, actor.siteId, flowId);
  if (!flow) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "flow not found") };
  }
  const revisionId = flow.deployment?.revision_id as string | undefined;
  if (flow.deployment?.status === "active" && revisionId) {
    const released = await requestDeactivate(pool, actor.siteId, flowId, revisionId);
    if (!released.ok) {
      return released;
    }
  }
  await removeFlow(pool, actor.siteId, flowId);
  return { ok: true, status: 200, body: { ok: true } };
};

const removeFlow = async (pool: pg.Pool, siteId: string, flowId: string) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE api_tokens
       SET revoked_at = COALESCE(revoked_at, now()), flow_id = NULL
       WHERE flow_id = $1`,
      [flowId],
    );
    await client.query(`DELETE FROM test_sessions WHERE flow_id = $1`, [flowId]);
    await client.query(`DELETE FROM deployments WHERE flow_id = $1`, [flowId]);
    await client.query(`DELETE FROM flow_drafts WHERE id = $1 AND site_id = $2`, [flowId, siteId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
