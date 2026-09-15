/**
 * 로컬 기기 표. entity_id는 이 SQLite에만 둔다.
 */
import { createHash } from "node:crypto";
import type { DeviceKind } from "@howling/contracts";
import type Database from "better-sqlite3";
import { actionsOf, classifyEntity, displayNameOf } from "./classify.js";

export type DeviceRow = {
  readonly id: string;
  readonly entityId: string;
  readonly name: string;
  readonly kind: DeviceKind;
  readonly numeric: boolean;
  readonly available: boolean;
};

export type EntityHint = {
  readonly entityId: string;
  readonly state: string;
  readonly friendlyName?: string;
};

export const deviceIdOf = (runtimeId: string, entityId: string): string =>
  `dev_${createHash("sha256").update(`${runtimeId}\0${entityId}`).digest("hex").slice(0, 16)}`;

export const upsertDevices = (
  db: Database.Database,
  runtimeId: string,
  items: readonly EntityHint[],
): DeviceRow[] => {
  const upserted: DeviceRow[] = [];
  const find = db.prepare(`SELECT * FROM devices WHERE entity_id = ?`);
  const insert = db.prepare(
    `INSERT INTO devices (id, entity_id, name, kind, numeric, available, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  );
  const update = db.prepare(
    `UPDATE devices
     SET name = ?, kind = ?, numeric = ?, available = 1, updated_at = ?
     WHERE entity_id = ?`,
  );
  const now = new Date().toISOString();
  for (const item of items) {
    if (item.entityId === "") {
      continue;
    }
    const classified = classifyEntity(item.entityId, item.state);
    if (!classified) {
      continue;
    }
    const name = displayNameOf(item.entityId, item.friendlyName);
    const existing = find.get(item.entityId) as Record<string, unknown> | undefined;
    if (existing) {
      update.run(name, classified.kind, classified.numeric ? 1 : 0, now, item.entityId);
      upserted.push({
        ...mapRow(existing),
        name,
        kind: classified.kind,
        numeric: classified.numeric,
        available: true,
      });
      continue;
    }
    const id = deviceIdOf(runtimeId, item.entityId);
    insert.run(id, item.entityId, name, classified.kind, classified.numeric ? 1 : 0, now);
    upserted.push({
      id,
      entityId: item.entityId,
      name,
      kind: classified.kind,
      numeric: classified.numeric,
      available: true,
    });
  }
  return upserted;
};

export const syncDeviceCatalog = (
  db: Database.Database,
  runtimeId: string,
  items: readonly EntityHint[],
): DeviceRow[] => {
  const upserted = upsertDevices(db, runtimeId, items);
  const kept = new Set(upserted.map((row) => row.id));
  markUnavailable(
    db,
    listDevices(db)
      .map((row) => row.id)
      .filter((id) => !kept.has(id)),
  );
  return upserted;
};

export const getDevice = (db: Database.Database, id: string): DeviceRow | undefined => {
  const row = db.prepare(`SELECT * FROM devices WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRow(row) : undefined;
};

export const getDeviceByEntity = (
  db: Database.Database,
  entityId: string,
): DeviceRow | undefined => {
  const row = db.prepare(`SELECT * FROM devices WHERE entity_id = ?`).get(entityId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRow(row) : undefined;
};

export const listDevices = (db: Database.Database): DeviceRow[] => {
  const rows = db.prepare(`SELECT * FROM devices ORDER BY name`).all() as Record<string, unknown>[];
  return rows.map(mapRow);
};

export const markUnavailable = (db: Database.Database, ids: readonly string[]): void => {
  const stmt = db.prepare(`UPDATE devices SET available = 0, updated_at = ? WHERE id = ?`);
  const now = new Date().toISOString();
  for (const id of ids) {
    stmt.run(now, id);
  }
};

export const summariesOf = (rows: readonly DeviceRow[]) =>
  rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    actions: [...actionsOf(row.kind)],
    numeric: row.numeric,
    available: row.available,
  }));

const mapRow = (row: Record<string, unknown>): DeviceRow => ({
  id: String(row.id),
  entityId: String(row.entity_id),
  name: String(row.name),
  kind: row.kind as DeviceKind,
  numeric: Number(row.numeric) === 1,
  available: Number(row.available) === 1,
});
