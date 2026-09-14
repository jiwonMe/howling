import { describe, expect, it } from "vitest";
import { hashToken } from "../src/crypto.js";
import { sendToRuntime } from "../src/runtime/hub.js";
import { closeApi, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("runtime hub attach", () => {
  it("keeps a hello that arrives while the token is still being checked", async () => {
    const ctx = await startApi();
    await ctx.app.ready();
    const siteId = "site_hub_test";
    const runtimeId = "runtime_hub_test";
    const token = "hub-test-token";
    try {
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ($1, $2, now())
         ON CONFLICT (id) DO NOTHING`,
        [siteId, "Hub Test"],
      );
      await ctx.pool.query(
        `INSERT INTO runtime_registrations
           (id, site_id, runtime_id, token_hash, connection_generation, online, created_at)
         VALUES ($1, $2, $3, $4, 0, FALSE, now())
         ON CONFLICT (site_id) DO UPDATE
           SET runtime_id = EXCLUDED.runtime_id, token_hash = EXCLUDED.token_hash`,
        ["reg_hub_test", siteId, runtimeId, hashToken(token)],
      );
      const hello = {
        protocolVersion: 1 as const,
        messageId: "hello-1",
        runtimeId,
        siteId,
        connectionGeneration: 1,
        type: "hello",
        payload: { protocolVersion: 1, capabilities: { connectors: ["homeassistant"] } },
      };
      const socket = await ctx.app.injectWS(
        "/api/v1/runtime/ws",
        { headers: { authorization: `Bearer ${token}` } },
        { onOpen: (ws) => ws.send(JSON.stringify(hello)) },
      );
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(sendToRuntime(siteId, "capabilities", { connectors: [] })).toBe(true);
      socket.close();
    } finally {
      await ctx.pool.query(`DELETE FROM runtime_registrations WHERE id = $1`, ["reg_hub_test"]);
      await ctx.pool.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
      await closeApi(ctx);
    }
  }, 20_000);
});
