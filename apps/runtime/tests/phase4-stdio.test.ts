import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { connectMcpStdio } from "../src/mcp/stdio-client.js";
import { schemaDigest } from "../src/mcp/digest.js";

const stdioEntry = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../mcp-test/src/stdio.ts",
);
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

describe("phase 4 MCP stdio", () => {
  it("lists echo and calls it once through the official SDK", async () => {
    const session = await connectMcpStdio(process.execPath, [tsxCli, stdioEntry]);
    try {
      const tools = await session.listTools();
      expect(tools.map((item) => item.name).sort()).toEqual(["count", "echo", "fail"]);
      const echo = tools.find((item) => item.name === "echo");
      expect(schemaDigest(echo?.inputSchema)).toMatch(/^[a-f0-9]{64}$/);
      const result = await session.callTool("echo", { text: "ping" });
      expect(JSON.stringify(result)).toContain("ping");
    } finally {
      await session.close();
    }
  }, 20_000);
});
