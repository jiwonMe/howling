import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRuntimeApp } from "../src/app.js";
import { openSqlite } from "../src/db/client.js";
import { migrateSqlite } from "../src/db/migrate.js";

const migrations = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

describe("runtime health", () => {
  it("reports ready after sqlite migrations", async () => {
    const dir = mkdtempSync(join(tmpdir(), "howling-runtime-"));
    const db = openSqlite(join(dir, "runtime.sqlite"));
    migrateSqlite(db, migrations);
    const app = createRuntimeApp(db);
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json()).toEqual({ status: "ok", service: "runtime" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().status).toBe("ready");
    await app.close();
    db.close();
  });
});
