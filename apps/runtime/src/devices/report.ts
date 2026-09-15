/**
 * 기기 목록을 올린다. entity_id는 넣지 않는다.
 */
import { deviceSummarySchema, devicesSnapshotSchema } from "@howling/contracts";
import type Database from "better-sqlite3";
import type { GatewayHandle } from "../gateway/client.js";
import { listDevices, summariesOf } from "./store.js";

export const reportDevices = (gateway: GatewayHandle, db: Database.Database): boolean => {
  const devices = summariesOf(listDevices(db)).map((item) => deviceSummarySchema.parse(item));
  const payload = devicesSnapshotSchema.parse({ devices });
  return gateway.send("devices.snapshot", payload);
};
