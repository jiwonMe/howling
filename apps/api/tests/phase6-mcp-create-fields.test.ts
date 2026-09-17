import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { hashToken } from "../src/crypto.js";
import { runtimeBySite } from "../src/runtime/hub.js";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

const FIELDS = [
  { key: "occupied", type: "boolean", label: "재실" },
  { key: "state", type: "select", options: ["sunny", "cloudy"] },
];

const createdDevice = {
  id: "dev_env",
  name: "작업실 환경",
  kind: "fields",
  actions: ["set_fields"],
  numeric: false,
  available: true,
  origin: "virtual",
  state: "sunny",
  fields: [
    { key: "occupied", type: "boolean", label: "재실", value: false },
    { key: "state", type: "select", options: ["sunny", "cloudy"], value: "sunny" },
  ],
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

describe.skipIf(!postgresUp)("phase 6 mcp create_device fields", () => {
  it("creates a multi-field virtual device through MCP", async () => {
    const ctx = await startApi();
    await ctx.app.ready();
    const siteId = "site_mcp_fields";
    const runtimeId = "runtime_mcp_fields";
    const runtimeToken = "mcp-fields-runtime-token";
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING`,
        [siteId, "MCP Fields"],
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
        ["reg_mcp_fields", siteId, runtimeId, hashToken(runtimeToken)],
      );
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "editor", scopes: ["read", "edit"] },
      });
      const token = issued.json().token as string;

      const seen: unknown[] = [];
      const replyCreate = (ws: { send: (data: string) => void }, raw: unknown) => {
        const env = JSON.parse(typeof raw === "string" ? raw : String(raw)) as {
          type?: string;
          payload?: { requestId?: string; fields?: unknown };
        };
        if (env.type !== "devices.create" || !env.payload?.requestId) {
          return;
        }
        seen.push(env.payload);
        ws.send(
          JSON.stringify({
            protocolVersion: 1,
            messageId: "created-fields",
            runtimeId,
            siteId,
            connectionGeneration: 1,
            type: "devices.created",
            payload: {
              requestId: env.payload.requestId,
              device: createdDevice,
              devices: [createdDevice],
            },
          }),
        );
      };
      const socket = await ctx.app.injectWS(
        "/api/v1/runtime/ws",
        { headers: { authorization: `Bearer ${runtimeToken}` } },
        {
          onOpen: (ws) => {
            ws.on("message", (raw) => replyCreate(ws, raw));
            ws.send(
              JSON.stringify({
                protocolVersion: 1,
                messageId: "hello-mcp-fields",
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
      socket.on("message", (raw) => replyCreate(socket, raw));
      await expect
        .poll(() => runtimeBySite(siteId)?.socket.readyState === 1, { timeout: 5_000 })
        .toBe(true);

      const invalid = await callTool(ctx.app, token, "create_device", { name: "빈" });
      expect(invalid.statusCode).toBe(400);

      const created = await callTool(ctx.app, token, "create_device", {
        name: "작업실 환경",
        fields: FIELDS,
      });
      expect(created.statusCode).toBe(200);
      const body = JSON.parse(created.json().result.content[0].text as string) as {
        device: { kind: string; fields?: { key: string }[] };
        devices: unknown[];
      };
      expect(body.device.kind).toBe("fields");
      expect(body.device.fields?.map((item) => item.key)).toEqual(["occupied", "state"]);
      expect((seen[0] as { fields: { key: string }[] }).fields.map((item) => item.key)).toEqual([
        "occupied",
        "state",
      ]);
      expect(JSON.stringify(body)).not.toContain("entityId");
      expect(JSON.stringify(body)).not.toContain("__fields");
      socket.close();
    } finally {
      await ctx.pool.query(`DELETE FROM site_devices WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM api_tokens WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM runtime_registrations WHERE id = $1`, ["reg_mcp_fields"]);
      await ctx.pool.query(`DELETE FROM memberships WHERE site_id = $1`, [siteId]);
      await ctx.pool.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
      await closeApi(ctx);
    }
  }, 20_000);
});
