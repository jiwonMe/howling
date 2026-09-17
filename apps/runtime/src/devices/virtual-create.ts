/**
 * runtime 전용 가상 기기. HA helper를 만들지 않는다.
 */
import { randomUUID } from "node:crypto";
import {
  initialAttrsOf,
  isHelperCreate,
  productIdOf,
  productNameOf,
  productPartsOf,
  stateFromFields,
  type DeviceCreateRequest,
  type DeviceKind,
  type DeviceSummary,
  type ProductPart,
  type VirtualField,
} from "@howling/contracts";
import type Database from "better-sqlite3";
import { deviceIdOf, listDevices, mapDeviceRow, summariesOf, type DeviceRow } from "./store.js";

export const createVirtualDevices = (
  db: Database.Database,
  runtimeId: string,
  payload: DeviceCreateRequest,
): DeviceSummary[] => {
  const parts = partsOf(payload);
  if (parts.length === 0) {
    throw new Error("종류 또는 제품이 필요합니다.");
  }
  const rows = parts.map((part) =>
    upsertVirtual(
      db,
      runtimeId,
      productNameOf(payload.name, part.suffix),
      part,
      part.kind === "fields" ? payload.fields : undefined,
    ),
  );
  return summariesOf(rows);
};

const partsOf = (payload: DeviceCreateRequest): readonly ProductPart[] => {
  if (payload.fields && payload.fields.length > 0) {
    return [{ kind: "fields", suffix: "" }];
  }
  if (payload.product) {
    const parts = productPartsOf(payload.product);
    if (!parts || !productIdOf(payload.product)) {
      throw new Error("알 수 없는 제품입니다.");
    }
    return parts;
  }
  if (!payload.kind || isHelperCreate(payload)) {
    return [];
  }
  return [{ kind: payload.kind, suffix: "" }];
};

const upsertVirtual = (
  db: Database.Database,
  runtimeId: string,
  name: string,
  part: ProductPart,
  fields?: readonly VirtualField[],
): DeviceRow => {
  const existing = listDevices(db).find(
    (row) => row.origin === "virtual" && row.name === name && row.kind === part.kind && row.available,
  );
  if (existing) {
    return existing;
  }
  const entityId = `virtual:${randomUUID()}`;
  const id = deviceIdOf(runtimeId, entityId);
  const now = new Date().toISOString();
  const numeric = part.numeric === true || part.kind === "number" ? 1 : 0;
  const attrs = fields && fields.length > 0 ? initialAttrsOf(fields) : {};
  const state = fields && fields.length > 0 ? stateFromFields(attrs, fields) : stateOf(part.kind);
  db.prepare(
    `INSERT INTO devices
       (id, entity_id, name, kind, numeric, available, updated_at, origin, state, attrs_json)
     VALUES (?, ?, ?, ?, ?, 1, ?, 'virtual', ?, ?)`,
  ).run(id, entityId, name, part.kind, numeric, now, state, JSON.stringify(attrs));
  const row = db.prepare(`SELECT * FROM devices WHERE id = ?`).get(id) as Record<string, unknown>;
  return mapDeviceRow(row);
};

const stateOf = (kind: DeviceKind): string => {
  if (kind === "number") {
    return "0";
  }
  if (kind === "player") {
    return "idle";
  }
  return "off";
};
