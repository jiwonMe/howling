import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntimeApp } from "../src/app.js";
import { writeSecret } from "../src/secrets/store.js";
import { createPairingState } from "../src/setup/pairing.js";
import { openTestDb } from "./helpers.js";

describe("runtime setup page", () => {
  it("serves the designed setup page without entity ids", async () => {
    const { db } = openTestDb();
    const secretRoot = mkdtempSync(join(tmpdir(), "howling-setup-"));
    const app = createRuntimeApp(db, undefined, {
      secretRoot,
      pairing: createPairingState(),
      pairingDeps: {
        apiHttpUrl: "http://127.0.0.1:3000",
        secretRoot,
        onCredential: () => undefined,
      },
      onHaSaved: () => undefined,
    });
    const page = await app.inject({ method: "GET", url: "/setup" });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("vbg-report");
    expect(page.body).toContain("Howling");
    expect(page.body).toContain("Pairing 시작");
    expect(page.body).toContain("허브 저장");
    expect(page.body).not.toContain("entity_id");
    expect(page.body).not.toContain("entityId");
    const css = await app.inject({ method: "GET", url: "/setup/vercel-brand.css" });
    expect(css.statusCode).toBe(200);
    expect(css.headers["content-type"]).toContain("text/css");
    expect(css.body.startsWith("/* vbg-bundle:start */")).toBe(true);
    writeSecret(secretRoot, "runtime-token", "paired-token");
    const status = await app.inject({ method: "GET", url: "/v1/setup/status" });
    expect(status.json().pairing.status).toBe("ready");
    await app.close();
    db.close();
  });
});
