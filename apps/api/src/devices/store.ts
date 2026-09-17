/**
 * cloud 기기 목록. entity_id는 저장하지 않는다.
 */
import type { DeviceSummary } from "@howling/contracts";
import type pg from "pg";

export const replaceSiteDevices = async (
  pool: pg.Pool,
  siteId: string,
  devices: readonly DeviceSummary[],
): Promise<void> => {
  for (const item of devices) {
    await upsertSiteDevice(pool, siteId, item);
  }
  const ids = devices.map((item) => item.id);
  if (ids.length === 0) {
    await pool.query(`UPDATE site_devices SET available = FALSE, updated_at = now() WHERE site_id = $1`, [
      siteId,
    ]);
    return;
  }
  await pool.query(
    `UPDATE site_devices
     SET available = FALSE, updated_at = now()
     WHERE site_id = $1 AND NOT (id = ANY($2::text[]))`,
    [siteId, ids],
  );
};

export const upsertSiteDevice = async (
  pool: pg.Pool,
  siteId: string,
  item: DeviceSummary,
): Promise<void> => {
  await pool.query(
    `INSERT INTO site_devices
       (site_id, id, name, kind, actions_json, numeric, available, state, reading, origin, deletable, fields_json, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12::jsonb, now())
     ON CONFLICT (site_id, id) DO UPDATE SET
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       actions_json = EXCLUDED.actions_json,
       numeric = EXCLUDED.numeric,
       available = EXCLUDED.available,
       state = EXCLUDED.state,
       reading = EXCLUDED.reading,
       origin = EXCLUDED.origin,
       deletable = EXCLUDED.deletable,
       fields_json = EXCLUDED.fields_json,
       updated_at = now()`,
    [
      siteId,
      item.id,
      item.name,
      item.kind,
      JSON.stringify(item.actions),
      item.numeric,
      item.available,
      item.state ?? null,
      item.reading ?? null,
      item.origin === "virtual" ? "virtual" : "ha",
      item.deletable === true,
      item.fields ? JSON.stringify(item.fields) : null,
    ],
  );
};

export const listSiteDevices = async (
  pool: pg.Pool,
  siteId: string,
): Promise<DeviceSummary[]> => {
  const result = await pool.query<{
    id: string;
    name: string;
    kind: DeviceSummary["kind"];
    actions_json: unknown;
    numeric: boolean;
    available: boolean;
    state: string | null;
    reading: string | null;
    origin: string | null;
    deletable: boolean | null;
    fields_json: unknown;
  }>(
    `SELECT id, name, kind, actions_json, numeric, available, state, reading, origin, deletable, fields_json
     FROM site_devices WHERE site_id = $1 ORDER BY name`,
    [siteId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    actions: Array.isArray(row.actions_json) ? (row.actions_json as DeviceSummary["actions"]) : [],
    numeric: row.numeric,
    available: row.available,
    origin: row.origin === "virtual" ? "virtual" : "ha",
    deletable: row.deletable === true,
    ...(row.state ? { state: row.state } : {}),
    ...(row.reading ? { reading: row.reading } : {}),
    ...(Array.isArray(row.fields_json)
      ? { fields: row.fields_json as NonNullable<DeviceSummary["fields"]> }
      : {}),
  }));
};

export const deleteSiteDevice = async (
  pool: pg.Pool,
  siteId: string,
  deviceId: string,
): Promise<void> => {
  await pool.query(`DELETE FROM site_devices WHERE site_id = $1 AND id = $2`, [siteId, deviceId]);
};
