import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../src/config.js";
import { openSqlite } from "../src/db/client.js";
import { upsertIdentity } from "../src/db/identity.js";
import { migrateSqlite, migrationsReady } from "../src/db/migrate.js";

const migrations = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

describe("runtime sqlite", () => {
  it("applies the initial migration and stores identity", () => {
    const dir = mkdtempSync(join(tmpdir(), "howling-runtime-"));
    const db = openSqlite(join(dir, "runtime.sqlite"));
    migrateSqlite(db, migrations);
    expect(migrationsReady(db)).toBe(true);
    upsertIdentity(
      db,
      loadRuntimeConfig({
        RUNTIME_ID: "runtime_test",
        RUNTIME_SITE_ID: "site_test",
        RUNTIME_API_URL: "ws://127.0.0.1:9/api/v1/runtime/ws",
      }),
    );
    const row = db
      .prepare("SELECT runtime_id, site_id FROM runtime_identity WHERE id = 1")
      .get() as { runtime_id: string; site_id: string };
    expect(row.runtime_id).toBe("runtime_test");
    db.close();
  });
});
