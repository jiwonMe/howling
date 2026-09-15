/**
 * Streamable HTTP 대신 JSON-RPC POST. 토큰은 헤더에만 둔다.
 */
import { readRpcResult, rpcRequest } from "./jsonrpc.js";

export type McpTool = {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: unknown;
};

export interface McpSession {
  readonly listTools: () => Promise<readonly McpTool[]>;
  readonly callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly close: () => Promise<void>;
}

export const connectMcpHttp = async (
  url: string,
  token?: string,
): Promise<McpSession> => {
  let nextId = 1;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const call = async (method: string, params?: unknown): Promise<unknown> => {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(rpcRequest(nextId, method, params)),
    });
    nextId += 1;
    if (!response.ok) {
      throw new Error(`mcp http ${String(response.status)}`);
    }
    const text = await response.text();
    if (!text) {
      return undefined;
    }
    return readRpcResult(JSON.parse(text) as unknown);
  };
  await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "howling-runtime", version: "0.1.0" },
  });
  await call("notifications/initialized");
  return {
    listTools: async () => {
      const result = (await call("tools/list")) as { tools?: McpTool[] };
      return result.tools ?? [];
    },
    callTool: async (name, args) =>
      call("tools/call", { name, arguments: args }),
    close: async () => undefined,
  };
};
