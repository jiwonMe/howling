/**
 * MCP create_flow·rename_flow. 새 플로를 만들고, 초안이 있으면 version 1에 바로 저장한다.
 */
import {
  errorBody,
  errorCodes,
  triggerListSchema,
  type McpCreateFlow,
} from "@howling/contracts";
import type pg from "pg";
import { invalid } from "../mcp/invalid.js";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { presentFlow } from "./present.js";
import { createFlow, getFlow, renameFlow, saveDraft } from "./store.js";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** definition.id는 플로 id와 같아야 한다. 비어 있으면 채우고, 다르면 새 id로 맞춘다. */
const withFlowId = (definition: unknown, flowId: string): unknown =>
  isObject(definition) ? { ...definition, id: flowId } : definition;

export const createFlowFor = async (
  pool: pg.Pool,
  actor: Actor,
  input: McpCreateFlow,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit");
  if (scope) {
    return scope;
  }
  if (actor.flowId) {
    return {
      ok: false,
      status: 403,
      body: errorBody(errorCodes.scopeDenied, "token is bound to one flow"),
    };
  }
  const triggers = triggerListSchema.safeParse(input.triggers ?? []);
  if (!triggers.success) {
    return invalid("invalid triggers", triggers.error);
  }
  const flowId = await createFlow(pool, actor.siteId, input.name);
  if (input.definition !== undefined) {
    const saved = await saveDraft(pool, {
      siteId: actor.siteId,
      flowId,
      expectedVersion: 1,
      definition: withFlowId(input.definition, flowId),
      triggers: input.triggers ?? [],
      connections: input.connections ?? [],
      executionPolicy: { mode: "live", captureRaw: false },
    });
    if (saved !== "ok") {
      return { ok: false, status: 409, body: errorBody(errorCodes.conflict, "draft not saved") };
    }
  }
  const row = await getFlow(pool, actor.siteId, flowId);
  if (!row) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "flow not found") };
  }
  return { ok: true, status: 201, body: presentFlow(row) };
};

/** 이름만 바꾼다. 초안 version은 올리지 않는다. */
export const renameFlowFor = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
  name: string,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  const renamed = await renameFlow(pool, actor.siteId, flowId, name);
  if (renamed === "missing") {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "flow not found") };
  }
  const row = await getFlow(pool, actor.siteId, flowId);
  if (!row) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "flow not found") };
  }
  return { ok: true, status: 200, body: presentFlow(row) };
};
