/**
 * 로컬 MCP 세션. stdio는 SDK, HTTP는 JSON-RPC.
 */
import type { McpToolCatalogItem } from "@howling/contracts";
import { schemaDigest } from "./digest.js";
import { connectMcpHttp, type McpSession } from "./http-client.js";
import { readMcpToken, type McpStoredConfig } from "./secrets.js";
import { connectMcpStdio } from "./stdio-client.js";

export type OpenMcp = {
  readonly config: McpStoredConfig;
  readonly session: McpSession;
  readonly tools: readonly McpToolCatalogItem[];
  readonly digest: string;
};

export const openMcpConnection = async (
  secretRoot: string,
  config: McpStoredConfig,
): Promise<OpenMcp> => {
  const session = await openSession(secretRoot, config);
  const listed = await session.listTools();
  const tools = listed.map((item) => ({
    connectionId: config.id,
    tool: item.name,
    inputSchemaDigest: schemaDigest(item.inputSchema),
    ...(item.description ? { title: item.description } : {}),
  }));
  const digest = schemaDigest(tools.map((item) => [item.tool, item.inputSchemaDigest]));
  return { config, session, tools, digest };
};

const openSession = async (
  secretRoot: string,
  config: McpStoredConfig,
): Promise<McpSession> => {
  if (config.transport === "stdio") {
    if (!config.command) {
      throw new Error("stdio command required");
    }
    return connectMcpStdio(config.command, config.args ?? []);
  }
  if (!config.url) {
    throw new Error("http url required");
  }
  const token = config.auth === "bearer" ? readMcpToken(secretRoot, config.id) : undefined;
  return connectMcpHttp(config.url, token);
};
