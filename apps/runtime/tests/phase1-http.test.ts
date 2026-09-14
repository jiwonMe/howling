import { describe, expect, it } from "vitest";
import { createRuntimeApp } from "../src/app.js";
import { createTestHost } from "./helpers.js";

describe("phase 1 local HTTP", () => {
  it("starts a seeded artifact and shows snapshot seq plus outbox", async () => {
    const host = createTestHost();
    const app = createRuntimeApp(host.db, host);
    const created = await app.inject({
      method: "POST",
      url: "/v1/runs",
      payload: {
        artifactId: "power-alert",
        input: { power: 500 },
        mode: "auto",
        idempotencyKey: "http-smoke",
      },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json() as { runId: string; status: string };
    expect(body.status).toBe("started");
    const view = await app.inject({ method: "GET", url: `/v1/runs/${body.runId}` });
    expect(view.statusCode).toBe(200);
    const run = view.json() as {
      lastSeq: number;
      status: string;
      outbox: unknown[];
      progressionMode: string;
    };
    expect(run.lastSeq).toBeGreaterThan(0);
    expect(run.status).toBe("completed");
    expect(run.progressionMode).toBe("auto");
    expect(Array.isArray(run.outbox)).toBe(true);
    const events = await app.inject({
      method: "GET",
      url: `/v1/runs/${body.runId}/events`,
    });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.length).toBeGreaterThan(0);
    await app.close();
    host.stop();
    host.db.close();
  });
});
