/**
 * MCP 연결·catalog·effect 입력. session·transport wire는 없다.
 */
import { z } from "zod";

export const mcpTransportSchema = z.enum(["stdio", "http"]);
export const mcpAuthSchema = z.enum(["none", "bearer"]);
export const mcpServerStatusSchema = z.enum([
  "not_configured",
  "configured",
  "connecting",
  "ready",
  "error",
  "disconnected",
]);

export const mcpLocalSetupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  transport: mcpTransportSchema,
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  auth: mcpAuthSchema.default("none"),
  token: z.string().min(1).optional(),
  oauthAuthorizeUrl: z.string().url().optional(),
  oauthTokenUrl: z.string().url().optional(),
  oauthClientId: z.string().min(1).optional(),
});

export const mcpToolCatalogItemSchema = z.object({
  connectionId: z.string().min(1),
  tool: z.string().min(1),
  inputSchemaDigest: z.string().min(1),
  title: z.string().optional(),
});

export const mcpServerSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: mcpServerStatusSchema,
  tools: z.array(mcpToolCatalogItemSchema),
});

export const mcpSnapshotSchema = z.object({
  status: mcpServerStatusSchema,
  servers: z.array(mcpServerSnapshotSchema),
});

export const mcpEffectInputSchema = z.object({
  connectionId: z.string().min(1),
  tool: z.string().min(1),
  arguments: z.record(z.unknown()).default({}),
  inputSchemaDigest: z.string().min(1).optional(),
});

export const mcpToolScopeSchema = z.enum([
  "read",
  "edit",
  "deploy",
  "run",
  "data.read",
]);

export const MCP_TOOL_SCOPES = {
  list_flows: ["read"],
  get_flow: ["read"],
  save_draft: ["edit"],
  validate_flow: ["edit"],
  start_dry_run: ["run"],
  create_revision: ["deploy"],
  deploy_revision: ["deploy"],
  deactivate_flow: ["deploy"],
  delete_flow: ["edit"],
  start_live_run: ["run"],
  get_run: ["read"],
  get_run_summary: ["read"],
  get_run_detail: ["data.read"],
  list_devices: ["read"],
  create_device: ["edit"],
  update_device: ["edit"],
  delete_device: ["edit"],
} as const;

export const oauthCodePayloadSchema = z.object({
  state: z.string().min(1),
  code: z.string().min(1),
});

export type McpLocalSetup = z.infer<typeof mcpLocalSetupSchema>;
export type McpToolCatalogItem = z.infer<typeof mcpToolCatalogItemSchema>;
export type McpSnapshot = z.infer<typeof mcpSnapshotSchema>;
export type McpEffectInput = z.infer<typeof mcpEffectInputSchema>;
export type OauthCodePayload = z.infer<typeof oauthCodePayloadSchema>;
