import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { connectMcpHttp } from "../src/mcp/http-client.js";

describe("phase 5 MCP http client", () => {
  it("treats initialized 204 as success and lists tools", async () => {
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on("end", () => {
        const rpc = JSON.parse(Buffer.concat(chunks).toString() || "{}") as {
          id?: number;
          method?: string;
        };
        if (rpc.method === "notifications/initialized") {
          response.writeHead(204);
          response.end();
          return;
        }
        if (rpc.method === "initialize") {
          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: rpc.id,
              result: { protocolVersion: "2024-11-05" },
            }),
          );
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: rpc.id,
            result: { tools: [{ name: "echo", description: "Echo text" }] },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const session = await connectMcpHttp(`http://127.0.0.1:${String(port)}/mcp`, "test-mcp-token");
    const tools = await session.listTools();
    expect(tools[0]?.name).toBe("echo");
    await session.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
});
