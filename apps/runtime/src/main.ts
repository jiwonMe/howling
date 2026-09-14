/**
 * Runtime 진입점.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApp } from "./app.js";
import { loadRuntimeConfig } from "./config.js";
import { openSqlite } from "./db/client.js";
import { upsertIdentity } from "./db/identity.js";
import { migrateSqlite } from "./db/migrate.js";
import { startRuntimeGateway } from "./gateway/client.js";
import { readRuntimeToken } from "./token.js";

const config = loadRuntimeConfig();
const db = openSqlite(config.sqlitePath);
const migrations = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
migrateSqlite(db, migrations);
upsertIdentity(db, config);
const app = createRuntimeApp(db);
const gateway = startRuntimeGateway(config, readRuntimeToken(config));
await app.listen({ host: config.listenHost, port: config.listenPort });

const shutdown = () => {
  gateway.stop();
  void app.close().then(() => db.close());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
