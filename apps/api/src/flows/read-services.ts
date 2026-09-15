/**
 * 목록·조회·초안·검증. 권한만 먼저 본다.
 */
import { errorBody, errorCodes, type DraftSave } from "@howling/contracts";
import type pg from "pg";
import { runtimeIdBySite } from "../runtime/hub.js";
import { denied, outsideFlow, type Actor, type ServiceResult } from "./access.js";
import { readRunEvents } from "./events.js";
import { presentFlow, presentRun } from "./present.js";
import { getRun } from "./runs.js";
import { getFlow, listFlows, saveDraft } from "./store.js";
import { compileDefinition } from "./validate.js";

export const listFlowsFor = async (
  pool: pg.Pool,
  actor: Actor,
): Promise<ServiceResult> => {
  const scope = denied(actor, "read");
  if (scope) {
    return scope;
  }
  const rows = await listFlows(pool, actor.siteId);
  const flows = actor.flowId ? rows.filter((row) => row.id === actor.flowId) : rows;
  return { ok: true, status: 200, body: { flows } };
};

export const getFlowFor = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
): Promise<ServiceResult> => {
  const scope = denied(actor, "read") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  const row = await getFlow(pool, actor.siteId, flowId);
  if (!row) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "flow not found") };
  }
  return { ok: true, status: 200, body: presentFlow(row) };
};

export const saveDraftFor = async (
  pool: pg.Pool,
  actor: Actor,
  flowId: string,
  draft: DraftSave,
): Promise<ServiceResult> => {
  const scope = denied(actor, "edit") ?? outsideFlow(actor, flowId);
  if (scope) {
    return scope;
  }
  const result = await saveDraft(pool, {
    siteId: actor.siteId,
    flowId,
    expectedVersion: draft.expectedVersion,
    definition: draft.definition,
    triggers: draft.triggers,
    connections: draft.connections,
    executionPolicy: draft.executionPolicy ?? { mode: "live", captureRaw: false },
  });
  if (result === "conflict") {
    return { ok: false, status: 409, body: errorBody(errorCodes.conflict, "version conflict") };
  }
  if (result === "missing") {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "not found") };
  }
  return { ok: true, status: 200, body: { ok: true } };
};

export const validateFlowFor = (actor: Actor, definition: unknown): ServiceResult => {
  const scope = denied(actor, "edit");
  if (scope) {
    return scope;
  }
  const compiled = compileDefinition(definition);
  return { ok: compiled.ok, status: compiled.ok ? 200 : 400, body: compiled };
};

export const getRunFor = async (
  pool: pg.Pool,
  actor: Actor,
  runId: string,
): Promise<ServiceResult> => {
  const scope = denied(actor, "read");
  if (scope) {
    return scope;
  }
  const row = await getRun(pool, actor.siteId, runId);
  if (!row || (actor.flowId && row.flow_id !== actor.flowId)) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "run not found") };
  }
  return { ok: true, status: 200, body: presentRun(row) };
};

export const getRunSummaryFor = async (
  pool: pg.Pool,
  actor: Actor,
  runId: string,
  after = 0,
): Promise<ServiceResult> => {
  const scope = denied(actor, "read");
  if (scope) {
    return scope;
  }
  const body = await readRunEvents(pool, actor.siteId, runId, after, runtimeIdBySite(actor.siteId));
  if (!body) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "run not found") };
  }
  if (body.resync) {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.resyncRequired, "cursor is outside retention"),
    };
  }
  if (actor.flowId && body.run.flow_id !== actor.flowId) {
    return { ok: false, status: 404, body: errorBody(errorCodes.notFound, "run not found") };
  }
  return {
    ok: true,
    status: 200,
    body: {
      ...body.snapshot,
      cursor: body.items.at(-1)?.syncSeq ?? after,
      journal: body.items.map((item) => ({ syncSeq: item.syncSeq, item: item.item })),
    },
  };
};
