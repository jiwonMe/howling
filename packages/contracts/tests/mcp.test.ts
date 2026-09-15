import { describe, expect, it } from "vitest";
import {
  MCP_TOOL_SCOPES,
  connectionsSnapshotSchema,
  mcpEffectInputSchema,
  runtimeStatusSchema,
  tokenListItemSchema,
} from "../src/index.js";

describe("phase 4 contracts", () => {
  it("parses a scoped token list without the raw secret", () => {
    const parsed = tokenListItemSchema.parse({
      id: "tok_1",
      name: "reader",
      scopes: ["read"],
      flowId: null,
      createdAt: "2026-09-15T00:00:00.000Z",
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(parsed.scopes).toEqual(["read"]);
    expect("token" in parsed).toBe(false);
  });

  it("requires connectionId and tool on MCP effect input", () => {
    const parsed = mcpEffectInputSchema.parse({
      connectionId: "echo",
      tool: "echo",
      arguments: { text: "ping" },
    });
    expect(parsed.arguments).toEqual({ text: "ping" });
  });

  it("extends connections.snapshot with MCP servers", () => {
    const parsed = connectionsSnapshotSchema.parse({
      ha: { status: "ready", lastSyncAt: null },
      mcp: {
        status: "ready",
        servers: [
          {
            id: "echo",
            name: "Echo",
            status: "ready",
            tools: [
              {
                connectionId: "echo",
                tool: "echo",
                inputSchemaDigest: "abc",
              },
            ],
          },
        ],
      },
    });
    expect(parsed.mcp?.servers[0]?.tools[0]?.tool).toBe("echo");
  });

  it("keeps HA on runtimeStatus and accepts optional mcp", () => {
    const parsed = runtimeStatusSchema.parse({
      siteId: "site_dev",
      runtimeId: "runtime_dev",
      online: true,
      connectionGeneration: 1,
      lastSeenAt: null,
      capabilities: null,
      ha: { status: "ready" },
      mcp: { status: "ready", servers: [] },
    });
    expect(parsed.ha.status).toBe("ready");
    expect(parsed.mcp?.status).toBe("ready");
  });

  it("maps platform tools to scopes", () => {
    expect(MCP_TOOL_SCOPES.start_live_run).toEqual(["run"]);
    expect(MCP_TOOL_SCOPES.deploy_revision).toEqual(["deploy"]);
    expect(MCP_TOOL_SCOPES.deactivate_flow).toEqual(["deploy"]);
    expect(MCP_TOOL_SCOPES.delete_flow).toEqual(["edit"]);
    expect(MCP_TOOL_SCOPES.get_run_summary).toEqual(["read"]);
    expect(MCP_TOOL_SCOPES.get_run_detail).toEqual(["data.read"]);
  });
});
