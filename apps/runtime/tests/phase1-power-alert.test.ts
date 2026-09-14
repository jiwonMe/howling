import { describe, expect, it } from "vitest";
import { createTestHost, startRun } from "./helpers.js";

describe("phase 1 power-alert", () => {
  it("sends one notification when five inputs reach a mean of 1080", async () => {
    const host = createTestHost();
    const values = [800, 900, 1100, 1200, 1400];
    for (const [index, power] of values.entries()) {
      const started = await startRun(host, {
        artifactId: "power-alert",
        input: { power },
        idempotencyKey: `power-${String(index)}`,
      });
      expect(started.status).toBe("started");
    }
    const notifies = host.adapter.calls.filter(
      (call) => call.adapter === "test.notifications",
    );
    expect(notifies).toHaveLength(1);
    host.stop();
    host.db.close();
  });
});
