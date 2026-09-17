import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createEngine, createOfficialRegistry, type WorkflowDefinition } from "@howling/core";
import {
  sunsetDeskLightConnections,
  sunsetDeskLightDefinition,
  sunsetDeskLightTriggers,
} from "@howling/contracts";
import { describeFlowSchema } from "../src/mcp/schema.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

const callTool = (
  app: FastifyInstance,
  token: string,
  name: string,
  args: Record<string, unknown>,
) =>
  app.inject({
    method: "POST",
    url: "/mcp",
    headers: { authorization: `Bearer ${token}` },
    payload: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
  });

const resultOf = <T>(response: { json: () => { result: { content: { text: string }[] } } }): T =>
  JSON.parse(response.json().result.content[0]!.text) as T;

describe("flow schema example", () => {
  it("compiles the sunset desk light example with the official registry", () => {
    const engine = createEngine({ registry: createOfficialRegistry() });
    const compiled = engine.compile(
      sunsetDeskLightDefinition("flow-example") as unknown as WorkflowDefinition,
    );
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    const schema = describeFlowSchema();
    expect(schema.nodeCatalogVersion).toBeDefined();
    const nodes = schema.nodes as { type: string; configSchema: unknown }[];
    expect(nodes.map((item) => item.type)).toContain("core.condition");
    const condition = nodes.find((item) => item.type === "core.condition");
    expect(JSON.stringify(condition?.configSchema)).toContain('"in"');
  });
});

describe.skipIf(!postgresUp)("phase 7 mcp authoring", () => {
  it("creates, renames and drafts a flow with sun triggers, then lists runs", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "author", scopes: ["read", "edit", "deploy"] },
      });
      const token = issued.json().token as string;

      const described = await callTool(ctx.app, token, "describe_flow_schema", {});
      expect(described.statusCode).toBe(200);
      const schema = resultOf<{ example: { triggers: unknown[] }; triggers: { kinds: { kind: string }[] } }>(
        described,
      );
      expect(schema.triggers.kinds.map((item) => item.kind)).toEqual(
        expect.arrayContaining(["sun", "schedule", "device.changed"]),
      );

      const created = await callTool(ctx.app, token, "create_flow", { name: "일몰 작업실 조명" });
      expect(created.statusCode).toBe(200);
      const flow = resultOf<{ flowId: string; name: string; draft: { version: number } }>(created);
      expect(flow.name).toBe("일몰 작업실 조명");
      expect(flow.draft.version).toBe(1);

      const renamed = await callTool(ctx.app, token, "rename_flow", {
        flowId: flow.flowId,
        name: "Sunset desk light",
      });
      expect(renamed.statusCode).toBe(200);
      expect(resultOf<{ name: string }>(renamed).name).toBe("Sunset desk light");

      const badTrigger = await callTool(ctx.app, token, "save_draft", {
        flowId: flow.flowId,
        draft: {
          expectedVersion: 1,
          definition: sunsetDeskLightDefinition(flow.flowId),
          triggers: [{ id: "x", kind: "sun", connectionId: "ha", config: { event: "noon" } }],
          connections: sunsetDeskLightConnections,
        },
      });
      expect(badTrigger.statusCode).toBe(400);
      const rpcError = badTrigger.json().error as {
        message: string;
        data: { error: { issues: { path: string }[] } };
      };
      expect(rpcError.message).toContain("/0/config/event");
      expect(rpcError.data.error.issues[0]?.path).toBe("/0/config/event");

      const saved = await callTool(ctx.app, token, "save_draft", {
        flowId: flow.flowId,
        draft: {
          expectedVersion: 1,
          definition: sunsetDeskLightDefinition(flow.flowId),
          triggers: sunsetDeskLightTriggers,
          connections: sunsetDeskLightConnections,
        },
      });
      expect(saved.statusCode).toBe(200);

      const revision = await callTool(ctx.app, token, "create_revision", { flowId: flow.flowId });
      expect(revision.statusCode).toBe(200);
      expect(resultOf<{ revisionId: string }>(revision).revisionId).toBeTruthy();

      const runs = await callTool(ctx.app, token, "list_runs", { flowId: flow.flowId, limit: 5 });
      expect(runs.statusCode).toBe(200);
      expect(resultOf<{ runs: unknown[] }>(runs).runs).toEqual([]);

      const missingName = await callTool(ctx.app, token, "create_flow", {});
      expect(missingName.statusCode).toBe(400);
      expect(missingName.json().error.data.error.issues[0]?.path).toBe("/name");
    } finally {
      await closeApi(ctx);
    }
  });

  it("creates a flow with an initial draft in one call and rejects HA triggers without HA", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "author", scopes: ["read", "edit", "deploy"] },
      });
      const token = issued.json().token as string;
      const created = await callTool(ctx.app, token, "create_flow", {
        name: "with draft",
        definition: sunsetDeskLightDefinition("ignored"),
        triggers: sunsetDeskLightTriggers,
        connections: [],
      });
      expect(created.statusCode).toBe(200);
      const flow = resultOf<{
        flowId: string;
        draft: { version: number; definition: { id: string; nodes: unknown[] } };
      }>(created);
      expect(flow.draft.version).toBe(2);
      expect(flow.draft.definition.id).toBe(flow.flowId);
      expect(flow.draft.definition.nodes.length).toBe(8);

      const revision = await callTool(ctx.app, token, "create_revision", { flowId: flow.flowId });
      expect(revision.statusCode).toBe(400);
      expect(revision.json().error.message).toMatch(/HA connection/);
    } finally {
      await closeApi(ctx);
    }
  });
});
