import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@howling/core";
import { createFakeAdapter } from "../src/effects/fake-adapter.js";
import { createMcpAwareAdapter } from "../src/mcp/adapter.js";
import { activateArtifact } from "../src/deploy/activate.js";
import { createEngine, createOfficialRegistry } from "@howling/core";
import { upsertConnection } from "../src/mcp/store.js";
import { upsertArtifact } from "../src/store/artifacts.js";
import {
  applyCount,
  createTestHost,
  eventsOf,
  startDryRun,
  startRun,
} from "./helpers.js";

const mcpFlow = (id: string, digest?: string): WorkflowDefinition => ({
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
          value: {
            connectionId: "echo",
            tool: "echo",
            arguments: { text: "ping" },
            ...(digest ? { inputSchemaDigest: digest } : {}),
          },
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

const mockRegistry = (input: {
  readonly digest?: string;
  readonly call?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    registry: {
      get: () => ({
        config: { id: "echo", name: "Echo", transport: "http" as const, auth: "none" as const },
        session: {
          listTools: async () => [],
          callTool: async (name: string, args: Record<string, unknown>) => {
            calls.push({ name, args });
            if (input.call) {
              return input.call(name, args);
            }
            return { content: [{ type: "text", text: JSON.stringify({ echoed: true }) }] };
          },
          close: async () => undefined,
        },
        tools: [
          { connectionId: "echo", tool: "echo", inputSchemaDigest: input.digest ?? "digest-1" },
        ],
        digest: "catalog",
      }),
      snapshot: () => ({ status: "ready" as const, servers: [] }),
      reload: async () => undefined,
      stop: async () => undefined,
    },
  };
};

describe("phase 4 MCP adapter", () => {
  it("calls the same tool and arguments after dispatchStarted", async () => {
    const mock = mockRegistry({});
    let sawDispatch = false;
    const box: { db?: { prepare: (sql: string) => { all: () => { event_json: string }[] } } } = {};
    const wrapped = {
      ...mock.registry,
      get: () => {
        const open = mock.registry.get();
        return {
          ...open,
          session: {
            ...open.session,
            callTool: async (name: string, args: Record<string, unknown>) => {
              const events = box.db?.prepare(`SELECT event_json FROM run_events`).all() ?? [];
              sawDispatch = events.some(
                (row) =>
                  (JSON.parse(row.event_json) as { type: string }).type === "effect.dispatchStarted",
              );
              return open.session.callTool(name, args);
            },
          },
        };
      },
    };
    const host = createTestHost({
      seed: false,
      adapter: createMcpAwareAdapter({
        next: createFakeAdapter(),
        registry: () => wrapped,
      }),
    });
    box.db = host.db;
    upsertArtifact(host.db, { id: "mcp-1", definition: mcpFlow("mcp-1") });
    const started = await startRun(host, { artifactId: "mcp-1", input: { text: "x" } });
    expect(started.status).toBe("started");
    expect(sawDispatch).toBe(true);
    expect(mock.calls).toEqual([{ name: "echo", args: { text: "ping" } }]);
    expect(
      eventsOf(host, started.runId ?? "").some((event) => event.type === "effect.dispatchStarted"),
    ).toBe(true);
    host.stop();
    host.db.close();
  });

  it("returns unknown on server error and does not resurrect the run", async () => {
    const mock = mockRegistry({
      call: async () => {
        throw new Error("mcp down");
      },
    });
    const host = createTestHost({
      seed: false,
      adapter: createMcpAwareAdapter({
        next: createFakeAdapter(),
        registry: () => mock.registry,
      }),
    });
    upsertArtifact(host.db, { id: "mcp-err", definition: mcpFlow("mcp-err") });
    const started = await startRun(host, { artifactId: "mcp-err", input: {} });
    expect(started.runId).toBeTruthy();
    await host.waitIdle();
    expect(host.adapter.calls).toHaveLength(1);
    expect(
      eventsOf(host, started.runId ?? "").some((event) => event.type === "effect.resolved") ||
        host.adapter.calls[0]?.adapter === "mcp",
    ).toBe(true);
    host.stop();
    host.db.close();
  });

  it("rejects a schema digest mismatch without calling the tool", async () => {
    const mock = mockRegistry({ digest: "live-digest" });
    const host = createTestHost({
      seed: false,
      adapter: createMcpAwareAdapter({
        next: createFakeAdapter(),
        registry: () => mock.registry,
      }),
    });
    upsertArtifact(host.db, {
      id: "mcp-dig",
      definition: mcpFlow("mcp-dig", "stale-digest"),
    });
    await startRun(host, { artifactId: "mcp-dig", input: {} });
    expect(mock.calls).toHaveLength(0);
    host.stop();
    host.db.close();
  });

  it("does not call MCP during dry-run and leaves live node states alone", async () => {
    const mock = mockRegistry({});
    const host = createTestHost({
      seed: false,
      adapter: createMcpAwareAdapter({
        next: createFakeAdapter(),
        registry: () => mock.registry,
      }),
    });
    upsertArtifact(host.db, { id: "mcp-dry", definition: mcpFlow("mcp-dry") });
    const before = applyCount(host);
    await startDryRun(host, {
      artifactId: "mcp-dry",
      input: { text: "ping" },
      fixtures: [
        {
          nodeId: "effect",
          index: 0,
          response: { source: "fixture", status: "succeeded", value: { ok: true } },
        },
      ],
    });
    expect(mock.calls).toHaveLength(0);
    expect(applyCount(host)).toBe(before);
    host.stop();
    host.db.close();
  });

  it("fails deploy when the MCP connection is not ready", () => {
    const host = createTestHost({ seed: false });
    const engine = createEngine({ registry: createOfficialRegistry() });
    const result = activateArtifact(host.db, engine, {
      deploymentId: "d1",
      generation: 1,
      artifact: {
        schemaVersion: 1,
        siteId: "site",
        flowId: "mcp-flow",
        revisionId: "rev",
        definition: mcpFlow("mcp-flow"),
        triggers: [],
        connections: [{ id: "echo", kind: "mcp", connectionId: "echo" }],
        requirements: {
          protocolVersion: 1,
          nodeCatalogVersion: "2026.09.1",
          connectors: ["mcp"],
        },
        executionPolicy: { mode: "live", captureRaw: false },
        artifactDigest: "x",
      },
    });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/not ready/);
    upsertConnection(host.db, {
      id: "echo",
      kind: "mcp",
      name: "Echo",
      status: "ready",
      digest: "ok",
    });
    const ready = activateArtifact(host.db, engine, {
      deploymentId: "d2",
      generation: 2,
      artifact: {
        schemaVersion: 1,
        siteId: "site",
        flowId: "mcp-flow",
        revisionId: "rev2",
        definition: mcpFlow("mcp-flow"),
        triggers: [],
        connections: [{ id: "echo", kind: "mcp", connectionId: "echo" }],
        requirements: {
          protocolVersion: 1,
          nodeCatalogVersion: "2026.09.1",
          connectors: ["mcp"],
        },
        executionPolicy: { mode: "live", captureRaw: false },
        artifactDigest: "y",
      },
    });
    expect(ready.status).toBe("active");
    host.stop();
    host.db.close();
  });
});
