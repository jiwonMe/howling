/**
 * MCP tool → 같은 application service. 원문 payload는 넣지 않는다.
 */
import {
  MCP_TOOL_SCOPES,
  deviceCreateBodySchema,
  deviceUpdateBodySchema,
  draftSaveSchema,
  deployRequestSchema,
  flowRenameSchema,
  mcpCreateFlowSchema,
  testSessionRequestSchema,
} from "@howling/contracts";
import type pg from "pg";
import type { Actor, ServiceResult } from "../flows/access.js";
import { createFlowFor, renameFlowFor } from "../flows/create-flow.js";
import { createRevision } from "../flows/create-revision.js";
import { deactivateFlow } from "../flows/deactivate.js";
import { deleteFlow } from "../flows/delete.js";
import { deployRevision } from "../flows/deploy-revision.js";
import { requestRunDetail } from "../data/detail.js";
import {
  getFlowFor,
  getRunFor,
  getRunSummaryFor,
  listFlowsFor,
  listRunsFor,
  saveDraftFor,
  validateFlowFor,
} from "../flows/read-services.js";
import { startDryRun } from "../flows/start-dry-run.js";
import { startLiveRun } from "../flows/start-live-run.js";
import { actDeviceFor } from "../devices/act.js";
import { createDeviceFor } from "../devices/create.js";
import { deleteDeviceFor, updateDeviceFor } from "../devices/mutate.js";
import { listDevicesFor } from "../devices/read.js";
import { invalid } from "./invalid.js";
import { describeFlowSchemaFor } from "./schema.js";

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
  if (name === "describe_flow_schema") {
    return describeFlowSchemaFor(actor);
  }
  if (name === "list_flows") {
    return listFlowsFor(pool, actor);
  }
  if (name === "list_devices") {
    return listDevicesFor(pool, actor);
  }
  if (name === "act_device") {
    return actDeviceFor(pool, actor, String(args.deviceId ?? ""), {
      action: args.action,
      ...(args.data !== undefined ? { data: args.data } : {}),
    });
  }
  if (name === "create_device") {
    const parsed = deviceCreateBodySchema.safeParse(args);
    return parsed.success
      ? createDeviceFor(pool, actor, parsed.data)
      : invalid("name and kind or product or fields required", parsed.error);
  }
  if (name === "update_device") {
    const deviceId = String(args.deviceId ?? "");
    const body = deviceUpdateBodySchema.safeParse({ name: args.name });
    if (!body.success || deviceId === "") {
      return invalid("deviceId and name required", body.success ? undefined : body.error);
    }
    return updateDeviceFor(pool, actor, deviceId, body.data);
  }
  if (name === "delete_device") {
    const deviceId = String(args.deviceId ?? "");
    return deviceId === "" ? invalid("deviceId required") : deleteDeviceFor(pool, actor, deviceId);
  }
  return invokeFlow(pool, actor, name, args, flowId);
};

const invokeFlow = async (
  pool: pg.Pool,
  actor: Actor,
  name: ToolName,
  args: Record<string, unknown>,
  flowId: string,
): Promise<ServiceResult> => {
  if (name === "get_flow") {
    return flowId === "" ? invalid("flowId required") : getFlowFor(pool, actor, flowId);
  }
  if (name === "create_flow") {
    const parsed = mcpCreateFlowSchema.safeParse(args);
    return parsed.success
      ? createFlowFor(pool, actor, parsed.data)
      : invalid("name required", parsed.error);
  }
  if (name === "rename_flow") {
    const parsed = flowRenameSchema.safeParse({ name: args.name });
    if (!parsed.success || flowId === "") {
      return invalid("flowId and name required", parsed.success ? undefined : parsed.error);
    }
    return renameFlowFor(pool, actor, flowId, parsed.data.name);
  }
  if (name === "save_draft") {
    if (flowId === "") {
      return invalid("flowId required");
    }
    const parsed = draftSaveSchema.safeParse(args.draft ?? args);
    return parsed.success
      ? saveDraftFor(pool, actor, flowId, parsed.data)
      : invalid("invalid draft", parsed.error);
  }
  if (name === "validate_flow") {
    return validateFlowFor(actor, args.definition);
  }
  if (name === "start_dry_run") {
    const parsed = testSessionRequestSchema.safeParse(args);
    if (!parsed.success || flowId === "") {
      return invalid("invalid dry-run", parsed.success ? undefined : parsed.error);
    }
    return startDryRun(pool, actor, flowId, parsed.data);
  }
  if (name === "create_revision") {
    return flowId === "" ? invalid("flowId required") : createRevision(pool, actor, flowId);
  }
  if (name === "deploy_revision") {
    const parsed = deployRequestSchema.safeParse(args);
    if (!parsed.success || flowId === "") {
      return invalid("flowId and revisionId required", parsed.success ? undefined : parsed.error);
    }
    return deployRevision(pool, actor, flowId, parsed.data);
  }
  if (name === "deactivate_flow") {
    return flowId === "" ? invalid("flowId required") : deactivateFlow(pool, actor, flowId);
  }
  if (name === "delete_flow") {
    return flowId === "" ? invalid("flowId required") : deleteFlow(pool, actor, flowId);
  }
  return invokeRun(pool, actor, name, args, flowId);
};

const invokeRun = async (
  pool: pg.Pool,
  actor: Actor,
  name: ToolName,
  args: Record<string, unknown>,
  flowId: string,
): Promise<ServiceResult> => {
  if (name === "start_live_run") {
    const idempotencyKey = String(args.idempotencyKey ?? "");
    if (flowId === "" || idempotencyKey === "") {
      return invalid("flowId and idempotencyKey required");
    }
    return startLiveRun(pool, actor, flowId, {
      input: args.input,
      mode: args.mode === "manual" ? "manual" : "auto",
      idempotencyKey,
    });
  }
  if (name === "list_runs") {
    return listRunsFor(pool, actor, {
      ...(flowId !== "" ? { flowId } : {}),
      ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
    });
  }
  const runId = String(args.runId ?? "");
  if (runId === "") {
    return invalid("runId required");
  }
  if (name === "get_run") {
    return getRunFor(pool, actor, runId);
  }
  if (name === "get_run_detail") {
    return requestRunDetail(pool, actor, runId, {
      ...(typeof args.nodeId === "string" ? { nodeId: args.nodeId } : {}),
      ...(typeof args.field === "string" ? { field: args.field } : {}),
      ...(typeof args.sequence === "number" ? { sequence: args.sequence } : {}),
    });
  }
  return getRunSummaryFor(pool, actor, runId, Number(args.after ?? 0));
};
