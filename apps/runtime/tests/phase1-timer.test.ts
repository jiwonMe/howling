import { describe, expect, it } from "vitest";
import { createTestHost, outboxOf, startRun } from "./helpers.js";

describe("phase 1 timers", () => {
  it("stores the second dueAt from logical time after the first timer completes", async () => {
    let now = 0;
    const host = createTestHost({ now: () => now });
    const started = await startRun(host, { artifactId: "delay-effect", input: {} });
    const runId = started.runId!;
    const first = outboxOf(host, runId).find((row) => row.intent.kind === "timer");
    expect(first?.intent).toMatchObject({ kind: "timer", dueAt: 50 });
    now = 50;
    host.timers.fireDue();
    await host.waitIdle();
    const timers = outboxOf(host, runId).filter((row) => row.intent.kind === "timer");
    const second = timers.find((row) => row.effectId !== first?.effectId);
    expect(second?.intent).toMatchObject({ kind: "timer", dueAt: 100 });
    now = 100;
    host.timers.fireDue();
    await host.waitIdle();
    expect(host.adapter.calls).toHaveLength(1);
    expect(host.adapter.calls[0]?.adapter).toBe("test.echo");
    host.stop();
    host.db.close();
  });
});
