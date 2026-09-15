import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("flow deactivate", () => {
  it("rejects deactivate when nothing is active", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "Idle" },
      });
      const flowId = created.json().flowId as string;
      const off = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/deactivate`,
        headers: { cookie, "x-csrf-token": csrf },
      });
      expect(off.statusCode).toBe(409);
      expect(off.json().error.message).toBe("no active deployment");
    } finally {
      await closeApi(ctx);
    }
  });
});
