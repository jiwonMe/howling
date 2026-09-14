/**
 * PostgreSQL pool.
 */
import pg from "pg";

export const createPool = (databaseUrl: string): pg.Pool =>
  new pg.Pool({ connectionString: databaseUrl });
