import { describe, expect, it } from "vitest";
import { createRuntimeApp } from "../src/app.js";
import { createTestHost } from "./helpers.js";

describe("phase 3 local dry-run HTTP", () => {
  it("starts a dry-run without adapter calls", async () => {
    const host = createTestHost();
    const app = createRuntimeApp(host.db, host);
    const created = await app.inject({
      method: "POST",
      url: "/v1/runs",
      payload: {
        artifactId: "power-alert",
        input: { power: 1400 },
        mode: "auto",
        runMode: "dryRun",
        idempotencyKey: "http-dry",
        initialState: { mean: [800, 900, 1100, 1200] },
        fixtures: [
          {
            nodeId: "notify",
            index: 0,
            adapter: "test.notifications",
            operation: "send",
            response: { source: "fixture", status: "succeeded", value: { accepted: true } },
          },
        ],
      },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json() as { runId: string };
    const view = await app.inject({ method: "GET", url: `/v1/runs/${body.runId}` });
    expect(view.json().status).toBe("completed");
    expect(view.json().runMode).toBe("dryRun");
    expect(host.adapter.calls).toHaveLength(0);
    await app.close();
    host.stop();
    host.db.close();
  });
});
