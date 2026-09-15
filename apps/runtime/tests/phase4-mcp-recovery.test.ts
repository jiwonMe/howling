import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@howling/core";
import { createFakeAdapter } from "../src/effects/fake-adapter.js";
import { createMcpAwareAdapter } from "../src/mcp/adapter.js";
import { upsertArtifact } from "../src/store/artifacts.js";
import { createTestHost, outboxOf, reopenHost, startRun } from "./helpers.js";

const mcpFlow = (id: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id,
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "effect",
      type: "core.effect",
      version: 1,
      config: { adapter: "mcp", operation: "call_tool" },
      inputs: {
        request: {
          kind: "literal",
          value: { connectionId: "echo", tool: "echo", arguments: { text: "ping" } },
        },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: { nodeId: "input", port: "success" },
      target: { nodeId: "effect", port: "in" },
    },
  ],
});

describe("phase 4 MCP recovery", () => {
  it("does not call MCP again after a dispatchStarted crash", async () => {
    let calls = 0;
    const inner = createMcpAwareAdapter({
      next: createFakeAdapter(),
      registry: () => undefined,
    });
    const first = createTestHost({
      seed: false,
      adapter: {
        calls: inner.calls,
        execute: async (request) => {
          calls += 1;
          return { kind: "crash" };
        },
      },
    });
    upsertArtifact(first.db, { id: "mcp-rec", definition: mcpFlow("mcp-rec") });
    const started = await startRun(first, { artifactId: "mcp-rec", input: {} });
    expect(calls).toBe(1);
    expect(outboxOf(first, started.runId!).every((row) => row.status === "dispatchStarted")).toBe(
      true,
    );
    first.stop();
    first.db.close();

    let retry = 0;
    const second = reopenHost(first.path, {
      adapter: {
        calls: [],
        execute: async () => {
          retry += 1;
          return { source: "live", status: "succeeded", value: { ok: true } };
        },
      },
    });
    second.recover();
    await second.waitIdle();
    expect(retry).toBe(0);
    expect(outboxOf(second, started.runId!).some((row) => row.status === "unknown")).toBe(true);
    second.stop();
    second.db.close();
  });
});
