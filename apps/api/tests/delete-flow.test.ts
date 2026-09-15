import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

describe.skipIf(!postgresUp)("flow delete", () => {
  it("removes a draft and revokes a flow-scoped token", async () => {
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
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers,
        payload: { name: "bound", scopes: ["read"], flowId },
      });
      expect(issued.statusCode).toBe(201);
      const tokenId = issued.json().id as string;
      const gone = await ctx.app.inject({
        method: "DELETE",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers,
      });
      expect(gone.statusCode).toBe(200);
      const missing = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers: { cookie },
      });
      expect(missing.statusCode).toBe(404);
      const listed = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/flows`,
        headers: { cookie },
      });
      expect(
        (listed.json().flows as { id: string }[]).some((row) => row.id === flowId),
      ).toBe(false);
      const tokens = await ctx.pool.query<{ revoked_at: Date | null; flow_id: string | null }>(
        `SELECT revoked_at, flow_id FROM api_tokens WHERE id = $1`,
        [tokenId],
      );
      expect(tokens.rows[0]?.revoked_at).toBeTruthy();
      expect(tokens.rows[0]?.flow_id).toBeNull();
    } finally {
      await closeApi(ctx);
    }
  });

  it("keeps an active flow when runtime is offline", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers,
        payload: { name: "Live" },
      });
      const flowId = created.json().flowId as string;
      const revisionId = randomUUID();
      await ctx.pool.query(
        `INSERT INTO flow_revisions (id, flow_id, site_id, artifact_json, digest, created_at)
         VALUES ($1, $2, $3, '{}'::jsonb, 'x', now())`,
        [revisionId, flowId, siteId],
      );
      await ctx.pool.query(
        `INSERT INTO deployments
           (id, flow_id, site_id, revision_id, generation, status, created_at)
         VALUES ($1, $2, $3, $4, 1, 'active', now())`,
        [randomUUID(), flowId, siteId, revisionId],
      );
      const blocked = await ctx.app.inject({
        method: "DELETE",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers,
      });
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json().error.message).toBe("runtime offline");
      const still = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/flows/${flowId}`,
        headers: { cookie },
      });
      expect(still.statusCode).toBe(200);
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
        method: "DELETE",
        url: `/api/v1/sites/${siteId}/flows/${randomUUID()}`,
        headers: { cookie, "x-csrf-token": csrf },
      });
      expect(missing.statusCode).toBe(404);
    } finally {
      await closeApi(ctx);
    }
  });
});
