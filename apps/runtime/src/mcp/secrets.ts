/**
 * MCP 설정·토큰은 파일에만 둔다. SQLite에 토큰 없음.
 */
import { readSecret, writeSecret } from "../secrets/store.js";
import type { McpLocalSetup } from "@howling/contracts";

export type McpStoredConfig = Omit<McpLocalSetup, "token">;

export const mcpConfigName = (id: string): string => `mcp-${id}-config`;
export const mcpTokenName = (id: string): string => `mcp-${id}-token`;
export const mcpOauthName = (id: string): string => `mcp-${id}-oauth`;

export const writeMcpConfig = (
  root: string,
  config: McpStoredConfig,
  token?: string,
): void => {
  writeSecret(root, mcpConfigName(config.id), JSON.stringify(config));
  if (token) {
    writeSecret(root, mcpTokenName(config.id), token);
  }
};

export const readMcpConfig = (root: string, id: string): McpStoredConfig | undefined => {
  const raw = readSecret(root, mcpConfigName(id));
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as McpStoredConfig;
};

export const readMcpToken = (root: string, id: string): string | undefined =>
  readSecret(root, mcpTokenName(id));

export const writeMcpToken = (root: string, id: string, token: string): void => {
  writeSecret(root, mcpTokenName(id), token);
};

export const listMcpConfigIds = (root: string, ids: readonly string[]): McpStoredConfig[] =>
  ids.flatMap((id) => {
    const config = readMcpConfig(root, id);
    return config ? [config] : [];
  });
