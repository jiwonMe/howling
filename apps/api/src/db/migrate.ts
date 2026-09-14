/**
 * 명시적 schema version으로 SQL 파일을 적용한다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";

export const migratePostgres = async (
  pool: pg.Pool,
  directory: string,
): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL
    )
  `);
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [version],
    );
    if ((applied.rowCount ?? 0) > 0) {
      continue;
    }
    const sql = readFileSync(join(directory, file), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query(
        "INSERT INTO schema_migrations (version, applied_at) VALUES ($1, now())",
        [version],
      );
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
};

export const migrationsReady = async (
  pool: pg.Pool,
  version = "0003_journal",
): Promise<boolean> => {
  try {
    const result = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [version],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
};
