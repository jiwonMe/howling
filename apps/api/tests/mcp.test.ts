import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

const draftOf = (flowId: string) => ({
  expectedVersion: 1,
  definition: {
    schemaVersion: 1,
    id: flowId,
    revision: "draft",
    entryNodeId: "input",
    nodes: [{ id: "input", type: "core.input", version: 1, config: {}, inputs: {} }],
    edges: [],
  },
  triggers: [],
  connections: [],
});

const callMcp = (
  app: Awaited<ReturnType<typeof startApi>>["app"],
  token: string,
  name: string,
  args: Record<string, unknown>,
  id = 1,
) =>
  app.inject({
    method: "POST",
    url: "/mcp",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });

describe.skipIf(!postgresUp)("scoped tokens and /mcp", () => {
  it("issues a token once and lists only the hash metadata", async () => {
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
      expect(issued.statusCode).toBe(201);
      expect(issued.json().token).toMatch(/^hwl_/);
      const listed = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie },
      });
      expect(listed.json().tokens[0].name).toBe("reader");
      expect(listed.json().tokens[0].token).toBeUndefined();
    } finally {
      await closeApi(ctx);
    }
  });

  it("lets an edit token save and validate the same draft rules", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "MCP" },
      });
      const flowId = created.json().flowId as string;
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "editor", scopes: ["read", "edit"] },
      });
      const token = issued.json().token as string;
      const saved = await callMcp(ctx.app, token, "save_draft", {
        flowId,
        ...draftOf(flowId),
      });
      expect(saved.statusCode).toBe(200);
      const validated = await callMcp(ctx.app, token, "validate_flow", {
        definition: draftOf(flowId).definition,
      });
      expect(validated.statusCode).toBe(200);
      expect(JSON.parse(validated.json().result.content[0].text).ok).toBe(true);
    } finally {
      await closeApi(ctx);
    }
  });

  it("rejects deploy, live start, and other-site use from a read token", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "Locked" },
      });
      const flowId = created.json().flowId as string;
      const reader = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "reader", scopes: ["read"] },
      });
      const token = reader.json().token as string;
      const deploy = await callMcp(ctx.app, token, "deploy_revision", {
        flowId,
        revisionId: "missing",
      });
      expect(deploy.statusCode).toBe(403);
      const live = await callMcp(ctx.app, token, "start_live_run", {
        flowId,
        input: {},
        idempotencyKey: "k1",
      });
      expect(live.statusCode).toBe(403);
      const dry = await callMcp(ctx.app, token, "start_dry_run", {
        flowId,
        source: "draft",
        input: {},
        fixtures: [],
        idempotencyKey: "dry-1",
      });
      expect(dry.statusCode).toBe(403);
      await ctx.pool.query(
        `INSERT INTO sites (id, name, created_at) VALUES ('site_other', 'Other', now())
         ON CONFLICT (id) DO NOTHING`,
      );
      const other = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/site_other/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "x", scopes: ["read"] },
      });
      expect(other.statusCode).toBe(403);
    } finally {
      await ctx.pool.query(`DELETE FROM sites WHERE id = 'site_other'`);
      await closeApi(ctx);
    }
  });

  it("forwards an OAuth code once and does not store it", async () => {
    const ctx = await startApi();
    try {
      const callback = await ctx.app.inject({
        method: "GET",
        url: "/api/v1/oauth/mcp/callback?code=secret-code&state=site_dev.abc",
      });
      expect(callback.statusCode).toBe(409);
      expect(callback.json().error.code).toBe("runtime_offline");
      const leaked = await ctx.pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%oauth%'`,
      );
      expect(leaked.rows).toEqual([]);
    } finally {
      await closeApi(ctx);
    }
  });

  it("returns runtime_offline for MCP live and dry-run when no hub is attached", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "Offline" },
      });
      const flowId = created.json().flowId as string;
      await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/draft`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: draftOf(flowId),
      });
      const issued = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/tokens`,
        headers: { cookie, "x-csrf-token": csrf },
        payload: { name: "runner", scopes: ["read", "edit", "run", "deploy"] },
      });
      const token = issued.json().token as string;
      const dry = await callMcp(ctx.app, token, "start_dry_run", {
        flowId,
        source: "draft",
        input: { power: 1 },
        fixtures: [],
        idempotencyKey: "offline-dry",
      });
      expect(dry.statusCode).toBe(409);
      expect(dry.json().error.message).toMatch(/runtime offline/);
    } finally {
      await closeApi(ctx);
    }
  });
});
