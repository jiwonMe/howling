import { describe, expect, it } from "vitest";
import { handleRuntimeControl } from "../src/runtime/inbound.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

const snapshotOf = (
  ctx: Awaited<ReturnType<typeof startApi>>,
  siteId: string,
  messageId: string,
  devices: readonly Record<string, unknown>[],
) =>
  handleRuntimeControl(ctx.pool, {
    protocolVersion: 1,
    messageId,
    runtimeId: ctx.config.bootstrapRuntimeId,
    siteId,
    connectionGeneration: 1,
    type: "devices.snapshot",
    payload: { devices },
  });

const power = {
  id: "dev_power",
  name: "Test Power",
  kind: "number",
  actions: [],
  numeric: true,
  available: true,
  state: "800",
};

const alert = {
  id: "dev_alert",
  name: "Test Alert",
  kind: "boolean",
  actions: ["turn_on", "turn_off", "toggle"],
  numeric: false,
  available: true,
};

describe.skipIf(!postgresUp)("phase 6 devices", () => {
  it("stores a snapshot, lists it, and keeps entity ids out of cloud rows", async () => {
    const ctx = await startApi();
    const siteId = "site_device_list";
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`,
        [siteId, "Device List"],
      );
      await ctx.pool.query(
        `INSERT INTO memberships (site_id, user_id, role)
         SELECT $1, user_id, 'owner' FROM memberships WHERE site_id = $2
         ON CONFLICT (site_id, user_id) DO NOTHING`,
        [siteId, ctx.config.bootstrapSiteId],
      );
      await snapshotOf(ctx, siteId, "m1", [power, alert]);

      const listed = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/devices`,
        headers: { cookie },
      });
      expect(listed.statusCode).toBe(200);
      const names = listed.json().devices.map((item: { name: string }) => item.name);
      expect(names).toContain("Test Alert");
      expect(names).toContain("Test Power");
      expect(
        listed.json().devices.find((item: { id: string }) => item.id === "dev_power").state,
      ).toBe("800");
      expect(
        listed.json().devices.find((item: { id: string }) => item.id === "dev_power").origin,
      ).toBe("ha");
      await snapshotOf(ctx, siteId, "m1b", [
        power,
        alert,
        {
          id: "dev_tv",
          name: "작업실 TV",
          kind: "player",
          actions: [],
          numeric: false,
          available: true,
          origin: "virtual",
        },
      ]);
      const withVirtual = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/devices`,
        headers: { cookie },
      });
      expect(
        withVirtual.json().devices.find((item: { id: string }) => item.id === "dev_tv").origin,
      ).toBe("virtual");
      expect(JSON.stringify(listed.json())).not.toContain("input_number");
      expect(JSON.stringify(listed.json())).not.toContain("entityId");

      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "reader", scopes: ["read"] },
      });
      const mcp = await ctx.app.inject({
        method: "POST",
        url: "/mcp",
        headers: { authorization: `Bearer ${issued.json().token as string}` },
        payload: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "list_devices", arguments: {} },
        },
      });
      expect(mcp.statusCode).toBe(200);
      const listedMcp = JSON.parse(mcp.json().result.content[0].text) as {
        devices: { name: string }[];
      };
      expect(listedMcp.devices.map((item) => item.name)).toContain("Test Power");
      expect(JSON.stringify(listedMcp)).not.toContain("entityId");

      await snapshotOf(ctx, siteId, "m2", [power]);
      const after = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/devices`,
        headers: { cookie },
      });
      const hidden = after
        .json()
        .devices.find((item: { id: string }) => item.id === "dev_alert") as { available: boolean };
      expect(hidden.available).toBe(false);

      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "Devices" },
      });
      const flowId = created.json().flowId as string;
      const saved = await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/draft`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: {
          expectedVersion: 1,
          definition: {
            schemaVersion: 1,
            id: flowId,
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
              {
                id: "effect",
                type: "core.effect",
                version: 1,
                config: { adapter: "device", operation: "action" },
                inputs: {
                  request: {
                    kind: "literal",
                    value: { deviceId: "dev_alert", action: "turn_on" },
                  },
                },
              },
            ],
            edges: [
              {
                id: "e1",
                source: { nodeId: "input", port: "success" },
                target: { nodeId: "mean", port: "in" },
              },
              {
                id: "e2",
                source: { nodeId: "mean", port: "success" },
                target: { nodeId: "effect", port: "in" },
              },
            ],
          },
          triggers: [
            {
              id: "device-trigger",
              kind: "device.changed",
              connectionId: "ha",
              config: { deviceId: "dev_power", inputKey: "power" },
            },
          ],
          connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
        },
      });
      expect(saved.statusCode).toBe(200);
      const revision = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/revisions`,
        headers: { cookie, "x-csrf-token": csrf },
      });
      expect(revision.statusCode).toBe(200);

      const cloud = await ctx.pool.query(
        `SELECT
           (SELECT definition_json::text || triggers_json::text
              FROM flow_drafts WHERE id = $1) AS drafts,
           (SELECT string_agg(artifact_json::text, '')
              FROM flow_revisions WHERE flow_id = $1) AS artifacts,
           (SELECT string_agg(id || name || kind, '')
              FROM site_devices WHERE site_id = $2) AS devices`,
        [flowId, siteId],
      );
      const blob = `${cloud.rows[0].drafts}${cloud.rows[0].artifacts}${cloud.rows[0].devices}`;
      expect(blob).not.toContain("input_number.");
      expect(blob).not.toContain("input_boolean.");
      expect(blob).not.toContain("entity_id");
    } finally {
      await ctx.pool.query(`DELETE FROM site_devices WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM memberships WHERE site_id = $1`, [siteId]);
      await closeApi(ctx);
    }
  });
});
