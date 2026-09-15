/**
 * 현재 사용자의 공간과 runtime 상태.
 */
import {
  errorBody,
  errorCodes,
  haStatusSchema,
  mcpSnapshotSchema,
  ownerPermissions,
  runtimeStatusSchema,
  siteListSchema,
} from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireSession } from "../auth/session.js";

export const registerSiteRoutes = (
  app: FastifyInstance,
  pool: pg.Pool,
): void => {
  app.get("/api/v1/sites", async (request, reply) => {
    const user = await requireSession(pool, request, reply);
    if (!user) {
      return;
    }
    const result = await pool.query<{ id: string; name: string; role: string }>(
      `SELECT sites.id, sites.name, memberships.role
       FROM memberships
       JOIN sites ON sites.id = memberships.site_id
       WHERE memberships.user_id = $1`,
      [user.id],
    );
    return siteListSchema.parse({
      sites: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: "owner" as const,
        permissions: [...ownerPermissions],
      })),
    });
  });

  app.get("/api/v1/sites/:siteId/runtime", async (request, reply) => {
    const user = await requireSession(pool, request, reply);
    if (!user) {
      return;
    }
    const { siteId } = request.params as { siteId: string };
    const allowed = await pool.query(
      `SELECT 1 FROM memberships WHERE site_id = $1 AND user_id = $2`,
      [siteId, user.id],
    );
    if ((allowed.rowCount ?? 0) === 0) {
      return reply
        .code(403)
        .send(errorBody(errorCodes.forbidden, "이 공간에 접근할 수 없습니다."));
    }
    const result = await pool.query<{
      site_id: string;
      runtime_id: string;
      online: boolean;
      connection_generation: number;
      last_seen_at: Date | null;
      capabilities: unknown;
    }>(
      `SELECT site_id, runtime_id, online, connection_generation, last_seen_at, capabilities
       FROM runtime_registrations
       WHERE site_id = $1`,
      [siteId],
    );
    const row = result.rows[0];
    if (!row) {
      return runtimeStatusSchema.parse({
        siteId,
        runtimeId: "unpaired",
        online: false,
        paired: false,
        connectionGeneration: 0,
        lastSeenAt: null,
        capabilities: null,
        ha: { status: "not_configured" },
      });
    }
    const caps = row.capabilities as {
      ha?: { status?: string; lastSyncAt?: string | null };
      mcp?: unknown;
    } | null;
    const haStatus = haStatusSchema.safeParse(caps?.ha?.status);
    const lastSyncAt = datetimeOrNull(caps?.ha?.lastSyncAt);
    const mcp = mcpSnapshotSchema.safeParse(caps?.mcp);
    return runtimeStatusSchema.parse({
      siteId: row.site_id,
      runtimeId: row.runtime_id,
      online: row.online,
      paired: true,
      connectionGeneration: row.connection_generation,
      lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
      capabilities: row.capabilities,
      ha: {
        status: haStatus.success ? haStatus.data : "not_configured",
        ...(lastSyncAt === undefined ? {} : { lastSyncAt }),
      },
      ...(mcp.success ? { mcp: mcp.data } : {}),
    });
  });
};

const datetimeOrNull = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) {
    return value;
  }
  return undefined;
};
