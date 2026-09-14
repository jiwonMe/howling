import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("runtime pairing", () => {
  it("issues a secret only to the runtime and rejects reuse or expiry", async () => {
    const ctx = await startApi({ BOOTSTRAP_RUNTIME_TOKEN: "" });
    try {
      const created = await ctx.app.inject({ method: "POST", url: "/api/v1/runtime-pairings" });
      expect(created.statusCode).toBe(200);
      const pairing = created.json() as {
        pairingId: string;
        code: string;
        runtimeSecret: string;
      };
      const noSecret = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/runtime-pairings/${pairing.pairingId}`,
      });
      expect(noSecret.statusCode).toBe(404);
      const pending = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/runtime-pairings/${pairing.pairingId}`,
        headers: { "x-runtime-secret": pairing.runtimeSecret },
      });
      expect(pending.json().status).toBe("pending");
      expect(pending.json().token).toBeUndefined();
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const claimed = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${ctx.config.bootstrapSiteId}/runtime/pair`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { code: pairing.code },
      });
      expect(claimed.statusCode).toBe(200);
      expect(claimed.json().runtimeId).toBeTruthy();
      expect(claimed.json().token).toBeUndefined();
      const readyPoll = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/runtime-pairings/${pairing.pairingId}`,
        headers: { "x-runtime-secret": pairing.runtimeSecret },
      });
      expect(readyPoll.json().status).toBe("claimed");
      expect(readyPoll.json().token).toBeTruthy();
      await ctx.app.inject({
        method: "POST",
        url: `/api/v1/runtime-pairings/${pairing.pairingId}/ack`,
        headers: { "x-runtime-secret": pairing.runtimeSecret },
      });
      const acked = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/runtime-pairings/${pairing.pairingId}`,
        headers: { "x-runtime-secret": pairing.runtimeSecret },
      });
      expect(acked.json().status).toBe("ready");
      expect(acked.json().token).toBeUndefined();
      const reuse = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${ctx.config.bootstrapSiteId}/runtime/pair`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { code: pairing.code },
      });
      expect(reuse.statusCode).toBe(404);
    } finally {
      await closeApi(ctx);
    }
  });

  it("rejects an expired pairing code", async () => {
    const ctx = await startApi({ BOOTSTRAP_RUNTIME_TOKEN: "" });
    try {
      const created = await ctx.app.inject({ method: "POST", url: "/api/v1/runtime-pairings" });
      const pairing = created.json() as { pairingId: string; code: string };
      await ctx.pool.query(`UPDATE runtime_pairings SET expires_at = now() - interval '1 minute' WHERE id = $1`, [
        pairing.pairingId,
      ]);
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const claimed = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${ctx.config.bootstrapSiteId}/runtime/pair`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { code: pairing.code },
      });
      expect(claimed.statusCode).toBe(404);
    } finally {
      await closeApi(ctx);
    }
  });
});
