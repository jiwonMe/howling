/**
 * 명시적 schema version으로 SQL 파일을 적용한다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

export const migrateSqlite = (db: Database.Database, directory: string): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const applied = db
      .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
      .get(version);
    if (applied) {
      continue;
    }
    const sql = readFileSync(join(directory, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(version, new Date().toISOString());
    })();
  }
};

export const migrationsReady = (
  db: Database.Database,
  version = "0007_devices",
): boolean => {
  const row = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(version);
  return Boolean(row);
};
