import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

const definition = (id: string) => ({
  schemaVersion: 1,
  id,
  revision: "draft",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "mean",
      type: "analysis.rolling-mean",
      version: 1,
      config: { windowSize: 5 },
      inputs: {
        value: { kind: "output", nodeId: "input", output: "value", path: "/power" },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: { nodeId: "input", port: "success" },
      target: { nodeId: "mean", port: "in" },
    },
  ],
});

describe.skipIf(!postgresUp)("flow draft and revision", () => {
  it("returns 409 on draft version conflict and keeps digest when layout changes", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers,
        payload: { name: "Mean" },
      });
      const flowId = created.json().flowId as string;
      const draftBody = {
        expectedVersion: 1,
        definition: definition(flowId),
        triggers: [
          {
            id: "t1",
            kind: "ha.state_changed",
            connectionId: "ha",
            config: { entityId: "input_number.test_power", inputKey: "power" },
          },
        ],
        connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
      };
      const saved = await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/draft`,
        headers,
        payload: draftBody,
      });
      expect(saved.statusCode).toBe(200);
      const conflict = await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/draft`,
        headers,
        payload: draftBody,
      });
      expect(conflict.statusCode).toBe(409);
      const first = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/revisions`,
        headers,
        payload: {},
      });
      expect(first.statusCode).toBe(200);
      await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/editor`,
        headers,
        payload: {
          expectedVersion: 1,
          positions: { input: { x: 40, y: 80 } },
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      });
      const second = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/revisions`,
        headers,
        payload: {},
      });
      expect(second.json().digest).toBe(first.json().digest);
      const bad = await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/draft`,
        headers,
        payload: {
          expectedVersion: 2,
          definition: {
            ...definition(flowId),
            nodes: [
              { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
              {
                id: "mean",
                type: "analysis.rolling-mean",
                version: 1,
                config: { windowSize: 5 },
                inputs: {
                  value: { kind: "output", nodeId: "missing", output: "value" },
                },
              },
            ],
          },
          triggers: draftBody.triggers,
          connections: draftBody.connections,
        },
      });
      expect(bad.statusCode).toBe(200);
      const rejected = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/revisions`,
        headers,
        payload: {},
      });
      expect(rejected.statusCode).toBe(400);
    } finally {
      await closeApi(ctx);
    }
  });
});
