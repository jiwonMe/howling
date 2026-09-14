/**
 * 로컬 identity 행. 자격증명은 넣지 않는다.
 */
import type Database from "better-sqlite3";
import type { RuntimeConfig } from "../config.js";

export const upsertIdentity = (
  db: Database.Database,
  config: RuntimeConfig,
): void => {
  db.prepare(
    `INSERT INTO runtime_identity (id, runtime_id, site_id, api_url)
     VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       runtime_id = excluded.runtime_id,
       site_id = excluded.site_id,
       api_url = excluded.api_url`,
  ).run(config.runtimeId, config.siteId, config.apiUrl);
};
