/**
 * 로컬 MCP 연결 목록과 snapshot.
 */
import type { McpSnapshot } from "@howling/contracts";
import type Database from "better-sqlite3";
import { openMcpConnection, type OpenMcp } from "./connector.js";
import { listMcpConfigIds, readMcpConfig } from "./secrets.js";
import { listConnections, upsertConnection } from "./store.js";

export interface McpRegistry {
  readonly get: (id: string) => OpenMcp | undefined;
  readonly snapshot: () => McpSnapshot;
  readonly reload: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

export const createMcpRegistry = (
  db: Database.Database,
  secretRoot: string,
): McpRegistry => {
  const open = new Map<string, OpenMcp>();
  return {
    get: (id) => open.get(id),
    snapshot: () => snapshotOf(open, db),
    reload: async () => {
      await closeAll(open);
      const ids = listConnections(db, "mcp").map((row) => row.id);
      for (const config of listMcpConfigIds(secretRoot, ids)) {
        try {
          const next = await openMcpConnection(secretRoot, config);
          open.set(config.id, next);
          upsertConnection(db, {
            id: config.id,
            kind: "mcp",
            name: config.name,
            status: "ready",
            digest: next.digest,
          });
        } catch {
          upsertConnection(db, {
            id: config.id,
            kind: "mcp",
            name: readMcpConfig(secretRoot, config.id)?.name ?? config.id,
            status: "error",
          });
        }
      }
    },
    stop: async () => {
      await closeAll(open);
    },
  };
};

const snapshotOf = (open: Map<string, OpenMcp>, db: Database.Database): McpSnapshot => {
  const servers: McpSnapshot["servers"][number][] = [...open.values()].map((item) => ({
    id: item.config.id,
    name: item.config.name,
    status: "ready",
    tools: [...item.tools],
  }));
  const seen = new Set(servers.map((item) => item.id));
  for (const row of listConnections(db, "mcp")) {
    if (seen.has(row.id)) {
      continue;
    }
    servers.push({
      id: row.id,
      name: row.name,
      status: row.status === "error" ? "error" : "configured",
      tools: [],
    });
  }
  return { status: overallStatus(servers), servers };
};

const overallStatus = (
  servers: readonly { readonly status: string }[],
): McpSnapshot["status"] => {
  if (servers.some((item) => item.status === "ready")) {
    return "ready";
  }
  if (servers.some((item) => item.status === "error")) {
    return "error";
  }
  return servers.length > 0 ? "configured" : "not_configured";
};

const closeAll = async (open: Map<string, OpenMcp>): Promise<void> => {
  for (const item of open.values()) {
    await item.session.close();
  }
  open.clear();
};
