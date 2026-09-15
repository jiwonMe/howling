/**
 * 공식 SDK stdio transport. Cloud는 command를 보내지 않는다.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpSession, McpTool } from "./http-client.js";

export const connectMcpStdio = async (
  command: string,
  args: readonly string[] = [],
): Promise<McpSession> => {
  const transport = new StdioClientTransport({
    command,
    args: [...args],
  });
  const client = new Client({ name: "howling-runtime", version: "0.1.0" });
  await client.connect(transport);
  return {
    listTools: async () => {
      const listed = await client.listTools();
      return listed.tools.map(
        (item): McpTool => ({
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
          ...(item.inputSchema ? { inputSchema: item.inputSchema } : {}),
        }),
      );
    },
    callTool: async (name, toolArgs) => {
      const result = await client.callTool({ name, arguments: toolArgs });
      return result;
    },
    close: async () => {
      await client.close();
    },
  };
};
