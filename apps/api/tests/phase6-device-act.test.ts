import { describe, expect, it } from "vitest";
import { hashToken } from "../src/crypto.js";
import { runtimeBySite } from "../src/runtime/hub.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("phase 6 device act", () => {
  it("rejects act when runtime is offline or the body is invalid", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const offline = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/devices/dev_alert/actions`,
        headers,
        payload: { action: "turn_off" },
      });
      expect(offline.statusCode).toBe(409);
      const invalid = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/devices/dev_alert/actions`,
        headers,
        payload: { action: "" },
      });
      expect(invalid.statusCode).toBe(400);
    } finally {
      await closeApi(ctx);
    }
  });

  it("returns the acted device without HA entity ids", async () => {
    const ctx = await startApi();
    await ctx.app.ready();
    const siteId = "site_device_act";
    const runtimeId = "runtime_device_act";
    const token = "device-act-token";
    const device = {
      id: "dev_alert",
      name: "Test Alert",
      kind: "boolean",
      actions: ["turn_on", "turn_off", "toggle"],
      numeric: false,
      available: true,
      state: "off",
    };
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`,
        [siteId, "Device Act"],
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
        ["reg_device_act", siteId, runtimeId, hashToken(token)],
      );
      const replyAct = (ws: { send: (data: string) => void }, raw: unknown) => {
        const env = JSON.parse(typeof raw === "string" ? raw : String(raw)) as {
          type?: string;
          payload?: { requestId?: string; action?: string };
        };
        if (env.type !== "devices.action" || !env.payload?.requestId) {
          return;
        }
        ws.send(
          JSON.stringify({
            protocolVersion: 1,
            messageId: "acted-1",
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
        { headers: { authorization: `Bearer ${token}` } },
        {
          onOpen: (ws) => {
            ws.on("message", (raw) => replyAct(ws, raw));
            ws.send(
              JSON.stringify({
                protocolVersion: 1,
                messageId: "hello-act",
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
      await expect.poll(() => runtimeBySite(siteId)?.socket.readyState === 1, { timeout: 5_000 }).toBe(true);
      const acted = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/devices/dev_alert/actions`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { action: "turn_on" },
      });
      expect(acted.statusCode).toBe(200);
      expect(acted.json().device.state).toBe("on");
      expect(JSON.stringify(acted.json())).not.toContain("input_boolean");
      expect(JSON.stringify(acted.json())).not.toContain("entityId");
      socket.close();
    } finally {
      await ctx.pool.query(`DELETE FROM site_devices WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM runtime_registrations WHERE id = $1`, ["reg_device_act"]);
      await ctx.pool.query(`DELETE FROM memberships WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
      await closeApi(ctx);
    }
  }, 20_000);
});
