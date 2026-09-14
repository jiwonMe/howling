/**
 * API 진입점.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiApp } from "./app.js";
import { loadApiConfig } from "./config.js";
import { createPool } from "./db/client.js";
import { migratePostgres } from "./db/migrate.js";
import { seedBootstrap } from "./sites/provision.js";

const config = loadApiConfig();
const pool = createPool(config.databaseUrl);
const migrations = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
await migratePostgres(pool, migrations);
await seedBootstrap(pool, config);
const app = await createApiApp(config, pool);
await app.listen({ host: config.listenHost, port: config.listenPort });
