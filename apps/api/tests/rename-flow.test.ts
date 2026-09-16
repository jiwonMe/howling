import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("flow rename", () => {
  it("renames a draft without bumping its version", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers,
        payload: { name: "Power alert" },
      });
      const flowId = created.json().flowId as string;
      const renamed = await ctx.app.inject({
        method: "PATCH",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers,
        payload: { name: "  작업실 전력 경보  " },
      });
      expect(renamed.statusCode).toBe(200);
      expect(renamed.json()).toEqual({ flowId, name: "작업실 전력 경보" });
      const detail = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers: { cookie },
      });
      expect(detail.json().name).toBe("작업실 전력 경보");
      expect(detail.json().draft.version).toBe(1);
      const listed = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/flows`,
        headers: { cookie },
      });
      const row = (listed.json().flows as { id: string; name: string }[]).find(
        (item) => item.id === flowId,
      );
      expect(row?.name).toBe("작업실 전력 경보");
    } finally {
      await closeApi(ctx);
    }
  });

  it("rejects a blank name and requires csrf", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers,
        payload: { name: "Scratch" },
      });
      const flowId = created.json().flowId as string;
      const blank = await ctx.app.inject({
        method: "PATCH",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers,
        payload: { name: "   " },
      });
      expect(blank.statusCode).toBe(400);
      const noCsrf = await ctx.app.inject({
        method: "PATCH",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers: { cookie },
        payload: { name: "무단" },
      });
      expect(noCsrf.statusCode).toBe(403);
      const detail = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers: { cookie },
      });
      expect(detail.json().name).toBe("Scratch");
    } finally {
      await closeApi(ctx);
    }
  });

  it("returns 404 for an unknown flow", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const missing = await ctx.app.inject({
        method: "PATCH",
        url: `/api/v1/sites/${siteId}/flows/${randomUUID()}`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "없음" },
      });
      expect(missing.statusCode).toBe(404);
    } finally {
      await closeApi(ctx);
    }
  });
});
