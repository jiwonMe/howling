import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { hashToken } from "../src/crypto.js";
import { runtimeBySite } from "../src/runtime/hub.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

const device = {
  id: "dev_alert",
  name: "Test Alert",
  kind: "boolean",
  actions: ["turn_on", "turn_off", "toggle"],
  numeric: false,
  available: true,
  state: "off",
};

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

describe.skipIf(!postgresUp)("phase 6 mcp act_device", () => {
  it("lists act_device with a real input schema", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${ctx.config.bootstrapSiteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "reader", scopes: ["read"] },
      });
      const listed = await ctx.app.inject({
        method: "POST",
        url: "/mcp",
        headers: { authorization: `Bearer ${issued.json().token as string}` },
        payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      });
      expect(listed.statusCode).toBe(200);
      const tools = listed.json().result.tools as {
        name: string;
        description: string;
        inputSchema: { required?: string[]; properties?: Record<string, unknown> };
      }[];
      const act = tools.find((item) => item.name === "act_device");
      expect(act).toBeDefined();
      expect(act?.inputSchema.required).toEqual(["deviceId", "action"]);
      expect(Object.keys(act?.inputSchema.properties ?? {})).toContain("data");
      expect(act?.description).toContain("run");
      for (const tool of tools) {
        expect(tool.inputSchema).toHaveProperty("type", "object");
        expect(tool.inputSchema.properties).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(5);
      }
    } finally {
      await closeApi(ctx);
    }
  });

  it("denies act_device to a read token and reports offline without a runtime", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const issue = (scopes: string[]) =>
        ctx.app
          .inject({
            method: "POST",
            url: `/api/v1/sites/${siteId}/tokens`,
            headers: { cookie, "x-csrf-token": csrf },
            payload: { name: scopes.join("+"), scopes },
          })
          .then((response) => response.json().token as string);
      const reader = await issue(["read"]);
      const runner = await issue(["run"]);

      const denied = await callTool(ctx.app, reader, "act_device", {
        deviceId: "dev_alert",
        action: "turn_on",
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json().error.message).toContain("run");

      const offline = await callTool(ctx.app, runner, "act_device", {
        deviceId: "dev_alert",
        action: "turn_on",
      });
      expect(offline.statusCode).toBe(409);
      expect(offline.json().error.message).toContain("offline");

      const missing = await callTool(ctx.app, runner, "act_device", { action: "turn_on" });
      expect(missing.statusCode).toBe(400);
    } finally {
      await closeApi(ctx);
    }
  });

  it("acts on a device through the runtime and returns the summary", async () => {
    const ctx = await startApi();
    await ctx.app.ready();
    const siteId = "site_mcp_act";
    const runtimeId = "runtime_mcp_act";
    const runtimeToken = "mcp-act-runtime-token";
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`,
        [siteId, "MCP Act"],
      );
      await ctx.pool.query(
        `INSERT INTO memberships (site_id, user_id, role)
         SELECT $1, user_id, 'owner' FROM memberships WHERE site_id = $2
         ON CONFLICT (site_id, user_id) DO NOTHING`,
        [siteId, ctx.config.bootstrapSiteId],
      );
      await ctx.pool.query(
        `INSERT INTO runtime_registrations
           (id, site_id, runtime_id, token_hash, connection_generation, online, created_at)
         VALUES ($1, $2, $3, $4, 0, FALSE, now())
         ON CONFLICT (site_id) DO UPDATE
           SET runtime_id = EXCLUDED.runtime_id, token_hash = EXCLUDED.token_hash`,
        ["reg_mcp_act", siteId, runtimeId, hashToken(runtimeToken)],
      );
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "runner", scopes: ["read", "run"] },
      });
      const token = issued.json().token as string;

      const seen: { action?: string; data?: unknown }[] = [];
      const replyAct = (ws: { send: (data: string) => void }, raw: unknown) => {
        const env = JSON.parse(typeof raw === "string" ? raw : String(raw)) as {
          type?: string;
          payload?: { requestId?: string; action?: string; data?: unknown };
        };
        if (env.type !== "devices.action" || !env.payload?.requestId) {
          return;
        }
        seen.push({ action: env.payload.action, data: env.payload.data });
        ws.send(
          JSON.stringify({
            protocolVersion: 1,
            messageId: `acted-${String(seen.length)}`,
            runtimeId,
            siteId,
            connectionGeneration: 1,
            type: "devices.acted",
            payload: {
              requestId: env.payload.requestId,
              device: { ...device, state: env.payload.action === "turn_on" ? "on" : "off" },
            },
          }),
        );
      };
      const socket = await ctx.app.injectWS(
        "/api/v1/runtime/ws",
        { headers: { authorization: `Bearer ${runtimeToken}` } },
        {
          onOpen: (ws) => {
            ws.on("message", (raw) => replyAct(ws, raw));
            ws.send(
              JSON.stringify({
                protocolVersion: 1,
                messageId: "hello-mcp-act",
                runtimeId,
                siteId,
                connectionGeneration: 1,
                type: "hello",
                payload: { protocolVersion: 1, capabilities: { connectors: ["homeassistant"] } },
              }),
            );
          },
        },
      );
      socket.on("message", (raw) => replyAct(socket, raw));
      await expect
        .poll(() => runtimeBySite(siteId)?.socket.readyState === 1, { timeout: 5_000 })
        .toBe(true);

      const acted = await callTool(ctx.app, token, "act_device", {
        deviceId: "dev_alert",
        action: "turn_on",
        data: { brightness_pct: 70 },
      });
      expect(acted.statusCode).toBe(200);
      const body = JSON.parse(acted.json().result.content[0].text as string) as {
        device: { id: string; state: string };
      };
      expect(body.device.id).toBe("dev_alert");
      expect(body.device.state).toBe("on");
      expect(seen[0]).toEqual({ action: "turn_on", data: { brightness_pct: 70 } });
      expect(JSON.stringify(body)).not.toContain("entityId");

      const listed = await callTool(ctx.app, token, "list_devices", {});
      const devices = JSON.parse(listed.json().result.content[0].text as string) as {
        devices: { id: string; state?: string }[];
      };
      expect(devices.devices.find((item) => item.id === "dev_alert")?.state).toBe("on");

      const withEntity = await callTool(ctx.app, token, "act_device", {
        deviceId: "dev_alert",
        action: "turn_on",
        data: { entity_id: "input_boolean.test_alert" },
      });
      expect(withEntity.statusCode).toBe(400);
      socket.close();
    } finally {
      await ctx.pool.query(`DELETE FROM site_devices WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM api_tokens WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM runtime_registrations WHERE id = $1`, ["reg_mcp_act"]);
      await ctx.pool.query(`DELETE FROM memberships WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
      await closeApi(ctx);
    }
  }, 20_000);
});
