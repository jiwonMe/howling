/**
 * MCP list_devices. entity_id는 없다.
 */
import type pg from "pg";
import { denied, type Actor, type ServiceResult } from "../flows/access.js";
import { listSiteDevices } from "./store.js";

export const listDevicesFor = async (
  pool: pg.Pool,
  actor: Actor,
): Promise<ServiceResult> => {
  const scope = denied(actor, "read");
  if (scope) {
    return scope;
  }
  return { ok: true, status: 200, body: { devices: await listSiteDevices(pool, actor.siteId) } };
};
