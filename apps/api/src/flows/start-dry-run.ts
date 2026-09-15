/**
 * Dry-run은 배포 없이 run 권한이 필요하다.
 */
import type { TestSessionRequest } from "@howling/contracts";
import type pg from "pg";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { startTestSession } from "./test-session.js";

export const startDryRun = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
  request: TestSessionRequest,
): Promise<ServiceResult> => {
  const scope = denied(actor, "run") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  return startTestSession(pool, actor.siteId, flowId, request);
};
