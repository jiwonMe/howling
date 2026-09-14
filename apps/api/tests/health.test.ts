import { describe, expect, it } from "vitest";
import type pg from "pg";
import { createApiApp } from "../src/app.js";
import { loadApiConfig } from "../src/config.js";

const failingPool = {
  query: async () => {
    throw new Error("no database");
  },
} as unknown as pg.Pool;

describe("api health", () => {
  it("returns process health without a database", async () => {
    const app = await createApiApp(loadApiConfig(), failingPool);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
    await app.close();
  });

  it("returns not_ready when the database is down", async () => {
    const app = await createApiApp(loadApiConfig(), failingPool);
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "not_ready",
      checks: { database: false, migrations: false },
    });
    await app.close();
  });
});
