import { describe, expect, it } from "vitest";
import { hashToken } from "../src/crypto.js";
import { runtimeBySite } from "../src/runtime/hub.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("phase 6 device create", () => {
  it("rejects create when runtime is offline or the body is invalid", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const offline = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/devices`,
        headers,
        payload: { name: "스위치", kind: "boolean" },
      });
      expect(offline.statusCode).toBe(409);
      expect(offline.json().error.code).toBe("runtime_offline");
      const invalid = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/devices`,
        headers,
        payload: { name: "", kind: "light" },
      });
      expect(invalid.statusCode).toBe(400);
    } finally {
      await closeApi(ctx);
    }
  });

  it("stores the created device from runtime without entity ids", async () => {
    const ctx = await startApi();
    await ctx.app.ready();
    const siteId = "site_device_create";
    const runtimeId = "runtime_device_create";
    const token = "device-create-token";
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now())
         ON CONFLICT (id) DO NOTHING`,
        [siteId, "Device Create"],
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
        ["reg_device_create", siteId, runtimeId, hashToken(token)],
      );
      const hello = {
        protocolVersion: 1 as const,
        messageId: "hello-create",
        runtimeId,
        siteId,
        connectionGeneration: 1,
        type: "hello",
        payload: { protocolVersion: 1, capabilities: { connectors: ["homeassistant"] } },
      };
      const replyCreate = (ws: { send: (data: string) => void }, raw: unknown) => {
        const env = JSON.parse(typeof raw === "string" ? raw : String(raw)) as {
          type?: string;
          payload?: { requestId?: string };
        };
        if (env.type !== "devices.create" || !env.payload?.requestId) {
          return;
        }
        ws.send(
          JSON.stringify({
            protocolVersion: 1,
            messageId: "created-1",
            runtimeId,
            siteId,
            connectionGeneration: 1,
            type: "devices.created",
            payload: {
              requestId: env.payload.requestId,
              device: {
                id: "dev_created",
                name: "새 스위치",
                kind: "boolean",
                actions: ["turn_on", "turn_off", "toggle"],
                numeric: false,
                available: true,
              },
            },
          }),
        );
      };
      const socket = await ctx.app.injectWS(
        "/api/v1/runtime/ws",
        { headers: { authorization: `Bearer ${token}` } },
        {
          onOpen: (ws) => {
            ws.on("message", (raw) => replyCreate(ws, raw));
            ws.send(JSON.stringify(hello));
          },
        },
      );
      socket.on("message", (raw) => replyCreate(socket, raw));
      await expect
        .poll(() => runtimeBySite(siteId)?.socket.readyState === 1, { timeout: 5_000 })
        .toBe(true);
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/devices`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "새 스위치", kind: "boolean" },
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().device.name).toBe("새 스위치");
      expect(JSON.stringify(created.json())).not.toContain("input_boolean");
      expect(JSON.stringify(created.json())).not.toContain("entityId");
      const listed = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/devices`,
        headers: { cookie },
      });
      expect(listed.json().devices.map((item: { name: string }) => item.name)).toContain("새 스위치");
      socket.close();
    } finally {
      await ctx.pool.query(`DELETE FROM site_devices WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM runtime_registrations WHERE id = $1`, ["reg_device_create"]);
      await ctx.pool.query(`DELETE FROM memberships WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
      await closeApi(ctx);
    }
  }, 20_000);
});
