/**
 * 동작 뒤 로컬 상태. entity_id는 쓰지 않는다.
 */
import { applyFieldData, fieldsFromAttrs, stateFromFields } from "@howling/contracts";
import type Database from "better-sqlite3";
import { getDevice, mapDeviceRow, type DeviceRow } from "./store.js";

export const nextDeviceState = (
  row: DeviceRow,
  action: string,
  data: Record<string, string | number | boolean>,
): { state: string; attrs: Record<string, string | number | boolean> } => {
  const attrs = { ...row.attrs, ...data };
  if (action === "turn_off" || action === "media_stop") {
    return { state: row.kind === "player" ? "idle" : "off", attrs };
  }
  if (action === "turn_on") {
    return { state: row.kind === "player" ? "idle" : "on", attrs };
  }
  if (action === "toggle") {
    const off = row.state === "off" || row.state === "idle";
    return { state: off ? (row.kind === "player" ? "playing" : "on") : "off", attrs };
  }
  if (action === "media_play" || action === "play_media") {
    return { state: "playing", attrs };
  }
  if (action === "media_pause") {
    return { state: "paused", attrs };
  }
  if (action === "set_value" && data.value !== undefined) {
    return { state: String(data.value), attrs };
  }
  if (action === "set_fields") {
    const fields = fieldsFromAttrs(row.attrs);
    if (fields.length === 0) {
      return { state: row.state, attrs: row.attrs };
    }
    const next = applyFieldData(row.attrs, fields, data);
    return { state: stateFromFields(next, fields), attrs: next };
  }
  return { state: row.state || "on", attrs };
};

export const writeDeviceState = (
  db: Database.Database,
  row: DeviceRow,
  action: string,
  data: Record<string, string | number | boolean>,
): DeviceRow => {
  const next = nextDeviceState(row, action, data);
  db.prepare(`UPDATE devices SET state = ?, attrs_json = ?, updated_at = ? WHERE id = ?`).run(
    next.state,
    JSON.stringify(next.attrs),
    new Date().toISOString(),
    row.id,
  );
  const updated = db.prepare(`SELECT * FROM devices WHERE id = ?`).get(row.id) as Record<string, unknown>;
  return mapDeviceRow(updated);
};

export const currentDevice = (db: Database.Database, id: string): DeviceRow | undefined => getDevice(db, id);
