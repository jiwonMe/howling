/**
 * core.effect adapter "device" operation "read". entity_id는 나가지 않는다.
 */
import { looksLikeEntityId, readingOf } from "@howling/contracts";
import type { JsonValue } from "@howling/core";
import type Database from "better-sqlite3";
import { getDevice, type DeviceRow } from "./store.js";

const ON_STATES = new Set(["on", "open", "unlocked", "playing", "home", "heating", "cooling"]);
const OFF_STATES = new Set(["off", "closed", "locked", "idle", "away", "docked", "standby"]);

/** "on"/"off"류 상태를 boolean으로. 그 외는 null. */
const onOf = (state: string): boolean | null => {
  if (ON_STATES.has(state)) {
    return true;
  }
  if (OFF_STATES.has(state)) {
    return false;
  }
  return null;
};

/** 숫자로 읽히는 state만 number로. 아니면 null. */
const valueOf = (state: string): number | null => {
  const trimmed = state.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const publicState = (state: string): string =>
  looksLikeEntityId(state) ? "" : state.slice(0, 64);

export const deviceValueOf = (row: DeviceRow): JsonValue => {
  const state = publicState(row.state);
  const reading = readingOf(row.kind, row.attrs);
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    available: row.available,
    state,
    value: valueOf(state),
    on: onOf(state),
    ...(reading && !looksLikeEntityId(reading) ? { reading } : {}),
    attrs: row.attrs,
  };
};

export const readDeviceValue = (db: Database.Database, deviceId: string): JsonValue | undefined => {
  const row = getDevice(db, deviceId);
  return row ? deviceValueOf(row) : undefined;
};
