/**
 * 공식 SDK stdio 서버. runtime 단위 테스트용.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createToolState } from "./tools.js";

const tools = createToolState();
const server = new McpServer({ name: "howling-mcp-test", version: "0.1.0" });

server.tool("echo", { text: z.string() }, async ({ text }) => {
  const result = tools.invoke("echo", { text });
  return { content: result.content, ...(result.isError ? { isError: true } : {}) };
});
server.tool("fail", async () => {
  const result = tools.invoke("fail", {});
  return { content: result.content, ...(result.isError ? { isError: true } : {}) };
});
server.tool("count", async () => {
  const result = tools.invoke("count", {});
  return { content: result.content };
});

await server.connect(new StdioServerTransport());
