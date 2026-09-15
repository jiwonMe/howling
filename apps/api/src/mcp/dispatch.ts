/**
 * MCP tool → 같은 application service. 원문 payload는 넣지 않는다.
 */
import {
  MCP_TOOL_SCOPES,
  draftSaveSchema,
  deployRequestSchema,
  testSessionRequestSchema,
} from "@howling/contracts";
import type pg from "pg";
import type { Actor, ServiceResult } from "../flows/access.js";
import { createRevision } from "../flows/create-revision.js";
import { deployRevision } from "../flows/deploy-revision.js";
import { requestRunDetail } from "../data/detail.js";
import {
  getFlowFor,
  getRunFor,
  getRunSummaryFor,
  listFlowsFor,
  saveDraftFor,
  validateFlowFor,
} from "../flows/read-services.js";
import { startDryRun } from "../flows/start-dry-run.js";
import { startLiveRun } from "../flows/start-live-run.js";

type ToolName = keyof typeof MCP_TOOL_SCOPES;

export const dispatchMcpTool = async (
  pool: pg.Pool,
  actor: Actor,
  name: string,
  args: Record<string, unknown>,
): Promise<ServiceResult> => {
  if (!(name in MCP_TOOL_SCOPES)) {
    return { ok: false, status: 404, body: { error: { code: "not_found", message: "unknown tool" } } };
  }
  return invoke(pool, actor, name as ToolName, args);
};

const invoke = async (
  pool: pg.Pool,
  actor: Actor,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<ServiceResult> => {
  const flowId = String(args.flowId ?? "");
  if (name === "list_flows") {
    return listFlowsFor(pool, actor);
  }
  if (name === "get_flow") {
    return getFlowFor(pool, actor, flowId);
  }
  if (name === "save_draft") {
    const parsed = draftSaveSchema.safeParse(args.draft ?? args);
    if (!parsed.success) {
      return { ok: false, status: 400, body: { error: { code: "invalid_request", message: "invalid draft" } } };
    }
    return saveDraftFor(pool, actor, flowId, parsed.data);
  }
  if (name === "validate_flow") {
    return validateFlowFor(actor, args.definition);
  }
  if (name === "start_dry_run") {
    const parsed = testSessionRequestSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, status: 400, body: { error: { code: "invalid_request", message: "invalid dry-run" } } };
    }
    return startDryRun(pool, actor, flowId, parsed.data);
  }
  if (name === "create_revision") {
    return createRevision(pool, actor, flowId);
  }
  if (name === "deploy_revision") {
    const parsed = deployRequestSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, status: 400, body: { error: { code: "invalid_request", message: "revisionId required" } } };
    }
    return deployRevision(pool, actor, flowId, parsed.data);
  }
  if (name === "start_live_run") {
    return startLiveRun(pool, actor, flowId, {
      input: args.input,
      mode: args.mode === "manual" ? "manual" : "auto",
      idempotencyKey: String(args.idempotencyKey ?? ""),
    });
  }
  if (name === "get_run") {
    return getRunFor(pool, actor, String(args.runId ?? ""));
  }
  if (name === "get_run_detail") {
    return requestRunDetail(pool, actor, String(args.runId ?? ""), {
      ...(typeof args.nodeId === "string" ? { nodeId: args.nodeId } : {}),
      ...(typeof args.field === "string" ? { field: args.field } : {}),
      ...(typeof args.sequence === "number" ? { sequence: args.sequence } : {}),
    });
  }
  return getRunSummaryFor(pool, actor, String(args.runId ?? ""), Number(args.after ?? 0));
};
