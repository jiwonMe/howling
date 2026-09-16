import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";

const mySites = async (
  app: Awaited<ReturnType<typeof startApi>>["app"],
  cookie: string,
): Promise<{ id: string; name: string; role: string }[]> => {
  const response = await app.inject({ method: "GET", url: "/api/v1/sites", headers: { cookie } });
  expect(response.statusCode).toBe(200);
  return response.json().sites as { id: string; name: string; role: string }[];
};

describe.skipIf(!postgresUp)("first login provisions a site", () => {
  it("attaches the bootstrap owner email to the bootstrap site", async () => {
    const ctx = await startApi({ BOOTSTRAP_OWNER_EMAIL: "owner@howling.test" });
    try {
      const { cookie } = await loginCookies(ctx.app, ctx.oidc);
      const sites = await mySites(ctx.app, cookie);
      expect(sites.map((site) => site.id)).toContain(ctx.config.bootstrapSiteId);
      expect(sites.find((site) => site.id === ctx.config.bootstrapSiteId)?.role).toBe("owner");
    } finally {
      await closeApi(ctx);
    }
  });

  it("gives anyone else their own site and keeps it on the next login", async () => {
    const ctx = await startApi({ BOOTSTRAP_OWNER_EMAIL: "someone-else@howling.life" });
    try {
      await ctx.pool.query(
        `DELETE FROM memberships WHERE user_id IN (SELECT id FROM users WHERE email = 'owner@howling.test')`,
      );
      const first = await loginCookies(ctx.app, ctx.oidc);
      const sites = await mySites(ctx.app, first.cookie);
      expect(sites).toHaveLength(1);
      const own = sites[0];
      expect(own?.id).not.toBe(ctx.config.bootstrapSiteId);
      expect(own?.id.startsWith("site_")).toBe(true);
      expect(own?.name).toBe("Home");
      expect(own?.role).toBe("owner");
      const bootstrapMembers = await ctx.pool.query(
        `SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
         WHERE m.site_id = $1 AND u.email = 'owner@howling.test'`,
        [ctx.config.bootstrapSiteId],
      );
      expect(bootstrapMembers.rowCount).toBe(0);

      const second = await loginCookies(ctx.app, ctx.oidc);
      const again = await mySites(ctx.app, second.cookie);
      expect(again.map((site) => site.id)).toEqual([own?.id]);
    } finally {
      // 개발 DB를 공유하므로 dev 계정을 bootstrap site owner로 되돌린다.
      await ctx.pool.query(
        `DELETE FROM memberships WHERE user_id IN (SELECT id FROM users WHERE email = 'owner@howling.test')`,
      );
      await ctx.pool.query(
        `INSERT INTO memberships (site_id, user_id, role)
         SELECT $1, id, 'owner' FROM users WHERE email = 'owner@howling.test'
         ON CONFLICT DO NOTHING`,
        [ctx.config.bootstrapSiteId],
      );
      await ctx.pool.query(
        `DELETE FROM sites WHERE name = 'Home' AND id <> $1
           AND NOT EXISTS (SELECT 1 FROM memberships WHERE memberships.site_id = sites.id)`,
        [ctx.config.bootstrapSiteId],
      );
      await closeApi(ctx);
    }
  });
});
