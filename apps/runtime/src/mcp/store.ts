/**
 * connection_configs: id·kind·name·status·digest만.
 */
import type Database from "better-sqlite3";

export type ConnectionRow = {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly status: string;
  readonly digest: string | null;
  readonly createdAt: string;
};

export const upsertConnection = (
  db: Database.Database,
  row: {
    readonly id: string;
    readonly kind: string;
    readonly name: string;
    readonly status: string;
    readonly digest?: string;
  },
): void => {
  db.prepare(
    `INSERT INTO connection_configs (id, kind, name, status, digest, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       kind = excluded.kind,
       name = excluded.name,
       status = excluded.status,
       digest = excluded.digest`,
  ).run(row.id, row.kind, row.name, row.status, row.digest ?? null, new Date().toISOString());
};

export const getConnection = (
  db: Database.Database,
  id: string,
): ConnectionRow | undefined => {
  const row = db.prepare(`SELECT * FROM connection_configs WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRow(row) : undefined;
};

export const listConnections = (
  db: Database.Database,
  kind?: string,
): ConnectionRow[] => {
  const rows = kind
    ? (db.prepare(`SELECT * FROM connection_configs WHERE kind = ?`).all(kind) as Record<
        string,
        unknown
      >[])
    : (db.prepare(`SELECT * FROM connection_configs`).all() as Record<string, unknown>[]);
  return rows.map(mapRow);
};

const mapRow = (row: Record<string, unknown>): ConnectionRow => ({
  id: String(row.id),
  kind: String(row.kind),
  name: String(row.name),
  status: String(row.status),
  digest: row.digest == null ? null : String(row.digest),
  createdAt: String(row.created_at),
});
