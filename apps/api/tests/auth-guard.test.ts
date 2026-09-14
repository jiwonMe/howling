import { describe, expect, it } from "vitest";
import type pg from "pg";
import { createApiApp } from "../src/app.js";
import { loadApiConfig } from "../src/config.js";

const failingPool = {
  query: async () => {
    throw new Error("no database");
  },
} as unknown as pg.Pool;

describe("api auth guard", () => {
  it("rejects runtime status without a session", async () => {
    const app = await createApiApp(loadApiConfig(), failingPool);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sites/site_dev/runtime",
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
    await app.close();
  });
});
