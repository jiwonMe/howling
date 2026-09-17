/**
 * 초안을 불변 revision으로 고정한다.
 */
import {
  errorBody,
  errorCodes,
  triggerListSchema,
  triggerNeedsHa,
  type RevisionArtifact,
} from "@howling/contracts";
import type pg from "pg";
import { invalid } from "../mcp/invalid.js";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { artifactFromDraft } from "./artifact.js";
import { getFlow, insertRevision } from "./store.js";
import { compileDefinition } from "./validate.js";

export const createRevision = async (
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
  const artifact = artifactFromDraft({
    siteId: actor.siteId,
    flowId,
    definition: flow.draft.definition_json as object,
    triggers: flow.draft.triggers_json as RevisionArtifact["triggers"],
    connections: flow.draft.connections_json as RevisionArtifact["connections"],
    executionPolicy: flow.draft.execution_policy_json as RevisionArtifact["executionPolicy"],
  });
  const compiled = compileDefinition(artifact.definition);
  if (!compiled.ok) {
    return { ok: false, status: 400, body: compiled };
  }
  const triggers = triggerListSchema.safeParse(artifact.triggers);
  if (!triggers.success) {
    return invalid("invalid triggers", triggers.error);
  }
  if (
    artifact.triggers.some((item) => triggerNeedsHa(item.kind)) &&
    !artifact.connections.some((item) => item.kind === "ha")
  ) {
    return {
      ok: false,
      status: 400,
      body: errorBody(errorCodes.invalidRequest, "HA trigger requires an HA connection"),
    };
  }
  await insertRevision(pool, actor.siteId, flowId, artifact);
  return {
    ok: true,
    status: 200,
    body: { revisionId: artifact.revisionId, digest: artifact.artifactDigest },
  };
};
