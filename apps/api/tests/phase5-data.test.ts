import { DEFAULT_DATA_POLICY } from "@howling/contracts";
import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("phase 5 data policy", () => {
  it("stores site policy and does not treat OFF as a completed purge", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/data-policy`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { ...DEFAULT_DATA_POLICY },
      });
      const got = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/data-policy`,
        headers: { cookie },
      });
      expect(got.statusCode).toBe(200);
      expect(got.json().policy.defaultCaptureRaw).toBe(false);
      const saved = await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/data-policy`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { ...DEFAULT_DATA_POLICY, defaultCaptureRaw: true },
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json().policy.defaultCaptureRaw).toBe(true);
    } finally {
      await closeApi(ctx);
    }
  });

  it("rejects detail requests without data.read", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "reader", scopes: ["read"] },
      });
      const token = issued.json().token as string;
      const denied = await ctx.app.inject({
        method: "POST",
        url: "/mcp",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_run_detail", arguments: { runId: "missing" } },
        },
      });
      expect(denied.statusCode).toBe(403);
    } finally {
      await closeApi(ctx);
    }
  });

  it("saves observation fields", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const saved = await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/observations`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: {
          fields: [{ id: "power", flowId: "flow", nodeId: "input", pointer: "/power" }],
        },
      });
      expect(saved.statusCode).toBe(200);
      const listed = await ctx.app.inject({
        url: `/api/v1/sites/${siteId}/observations`,
        headers: { cookie },
      });
      expect(listed.json().observations.fields[0].id).toBe("power");
    } finally {
      await closeApi(ctx);
    }
  });
});
