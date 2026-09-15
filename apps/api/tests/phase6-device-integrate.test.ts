import { describe, expect, it } from "vitest";
import { hashToken } from "../src/crypto.js";
import { runtimeBySite } from "../src/runtime/hub.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("phase 6 device integrate", () => {
  it("rejects an unknown integration without touching the paired site", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const rejected = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${ctx.config.bootstrapSiteId}/devices/integrations`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { integration: "mqtt" },
      });
      expect(rejected.statusCode).toBe(400);
    } finally {
      await closeApi(ctx);
    }
  });

  it("returns connected devices from runtime without entity ids", async () => {
    const ctx = await startApi();
    await ctx.app.ready();
    const siteId = "site_device_hue";
    const runtimeId = "runtime_device_hue";
    const token = "device-hue-token";
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`,
        [siteId, "Hue"],
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
        ["reg_device_hue", siteId, runtimeId, hashToken(token)],
      );
      const hello = {
        protocolVersion: 1 as const,
        messageId: "hello-hue",
        runtimeId,
        siteId,
        connectionGeneration: 1,
        type: "hello",
        payload: { protocolVersion: 1, capabilities: { connectors: ["homeassistant"] } },
      };
      const reply = (ws: { send: (data: string) => void }, raw: unknown) => {
        const env = JSON.parse(typeof raw === "string" ? raw : String(raw)) as {
          type?: string;
          payload?: { requestId?: string };
        };
        if (env.type !== "devices.integrate" || !env.payload?.requestId) {
          return;
        }
        ws.send(
          JSON.stringify({
            protocolVersion: 1,
            messageId: "integrated-1",
            runtimeId,
            siteId,
            connectionGeneration: 1,
            type: "devices.integrated",
            payload: {
              requestId: env.payload.requestId,
              status: "done",
              devices: [
                {
                  id: "dev_hue",
                  name: "거실 Hue",
                  kind: "light",
                  actions: ["turn_on", "turn_off", "toggle"],
                  numeric: false,
                  available: true,
                },
              ],
            },
          }),
        );
      };
      const socket = await ctx.app.injectWS(
        "/api/v1/runtime/ws",
        { headers: { authorization: `Bearer ${token}` } },
        {
          onOpen: (ws) => {
            ws.on("message", (raw) => reply(ws, raw));
            ws.send(JSON.stringify(hello));
          },
        },
      );
      socket.on("message", (raw) => reply(socket, raw));
      await expect.poll(() => runtimeBySite(siteId)?.socket.readyState === 1, { timeout: 5_000 }).toBe(true);
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/devices/integrations`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { integration: "hue" },
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().status).toBe("done");
      expect(created.json().devices[0].name).toBe("거실 Hue");
      expect(JSON.stringify(created.json())).not.toContain("light.");
      expect(JSON.stringify(created.json())).not.toContain("entityId");
      socket.close();
    } finally {
      await ctx.pool.query(`DELETE FROM site_devices WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM runtime_registrations WHERE id = $1`, ["reg_device_hue"]);
      await ctx.pool.query(`DELETE FROM memberships WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
      await closeApi(ctx);
    }
  }, 20_000);
});
