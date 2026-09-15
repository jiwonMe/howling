import { describe, expect, it } from "vitest";
import { hashToken } from "../src/crypto.js";
import { runtimeBySite } from "../src/runtime/hub.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("phase 6 device mutate", () => {
  it("rejects update and delete when runtime is offline or the body is invalid", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const offline = await ctx.app.inject({
        method: "PATCH",
        url: `/api/v1/sites/${siteId}/devices/dev_tv`,
        headers,
        payload: { name: "서재 TV" },
      });
      expect(offline.statusCode).toBe(409);
      const invalid = await ctx.app.inject({
        method: "PATCH",
        url: `/api/v1/sites/${siteId}/devices/dev_tv`,
        headers,
        payload: { name: "" },
      });
      expect(invalid.statusCode).toBe(400);
      const gone = await ctx.app.inject({
        method: "DELETE",
        url: `/api/v1/sites/${siteId}/devices/dev_tv`,
        headers,
      });
      expect(gone.statusCode).toBe(409);
    } finally {
      await closeApi(ctx);
    }
  });

  it("renames and deletes through runtime without entity ids", async () => {
    const ctx = await startApi();
    await ctx.app.ready();
    const siteId = "site_device_mutate";
    const runtimeId = "runtime_device_mutate";
    const token = "device-mutate-token";
    const device = {
      id: "dev_tv",
      name: "작업실 TV",
      kind: "player",
      actions: ["turn_on", "turn_off"],
      numeric: false,
      available: true,
      origin: "virtual",
      deletable: true,
    };
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`,
        [siteId, "Device Mutate"],
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
        ["reg_device_mutate", siteId, runtimeId, hashToken(token)],
      );
      const replyMutate = (ws: { send: (data: string) => void }, raw: unknown) => {
        const env = JSON.parse(typeof raw === "string" ? raw : String(raw)) as {
          type?: string;
          payload?: { requestId?: string; name?: string; deviceId?: string };
        };
        if (env.type === "devices.update" && env.payload?.requestId) {
          ws.send(
            JSON.stringify({
              protocolVersion: 1,
              messageId: "updated-1",
              runtimeId,
              siteId,
              connectionGeneration: 1,
              type: "devices.updated",
              payload: {
                requestId: env.payload.requestId,
                device: { ...device, name: env.payload.name ?? device.name },
              },
            }),
          );
        }
        if (env.type === "devices.delete" && env.payload?.requestId) {
          ws.send(
            JSON.stringify({
              protocolVersion: 1,
              messageId: "deleted-1",
              runtimeId,
              siteId,
              connectionGeneration: 1,
              type: "devices.deleted",
              payload: { requestId: env.payload.requestId, deviceId: env.payload.deviceId },
            }),
          );
        }
      };
      const socket = await ctx.app.injectWS(
        "/api/v1/runtime/ws",
        { headers: { authorization: `Bearer ${token}` } },
        {
          onOpen: (ws) => {
            ws.on("message", (raw) => replyMutate(ws, raw));
            ws.send(
              JSON.stringify({
                protocolVersion: 1,
                messageId: "hello-mutate",
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
      socket.on("message", (raw) => replyMutate(socket, raw));
      await expect.poll(() => runtimeBySite(siteId)?.socket.readyState === 1, { timeout: 5_000 }).toBe(true);
      const headers = { cookie, "x-csrf-token": csrf };
      const renamed = await ctx.app.inject({
        method: "PATCH",
        url: `/api/v1/sites/${siteId}/devices/dev_tv`,
        headers,
        payload: { name: "서재 TV" },
      });
      expect(renamed.statusCode).toBe(200);
      expect(renamed.json().device.name).toBe("서재 TV");
      expect(JSON.stringify(renamed.json())).not.toContain("entityId");
      const listed = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/devices`,
        headers: { cookie },
      });
      expect(listed.json().devices.find((item: { id: string }) => item.id === "dev_tv").name).toBe("서재 TV");
      const deleted = await ctx.app.inject({
        method: "DELETE",
        url: `/api/v1/sites/${siteId}/devices/dev_tv`,
        headers,
      });
      expect(deleted.statusCode).toBe(200);
      expect(deleted.json().deviceId).toBe("dev_tv");
      const after = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/devices`,
        headers: { cookie },
      });
      expect(after.json().devices.find((item: { id: string }) => item.id === "dev_tv")).toBeUndefined();
      socket.close();
    } finally {
      await ctx.pool.query(`DELETE FROM site_devices WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM runtime_registrations WHERE id = $1`, ["reg_device_mutate"]);
      await ctx.pool.query(`DELETE FROM memberships WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
      await closeApi(ctx);
    }
  }, 20_000);
});
