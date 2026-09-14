import { describe, expect, it } from "vitest";
import {
  createTestHost,
  eventsOf,
  haltWhenExternalRequested,
  outboxOf,
  reopenHost,
  runOf,
  startRun,
} from "./helpers.js";

describe("phase 1 pause cancel manual", () => {
  it("does not dispatch while paused and resumes only requested effects", async () => {
    const first = createTestHost({ afterCommit: haltWhenExternalRequested });
    const started = await startRun(first, {
      artifactId: "power-alert",
      input: { power: 1400 },
    });
    const runId = started.runId!;
    await first.enqueue({ kind: "pause", runId, commandId: "pause-1" });
    await first.waitIdle();
    expect(runOf(first, runId).status).toBe("paused");
    expect(first.adapter.calls).toHaveLength(0);
    first.stop();
    first.db.close();

    const second = reopenHost(first.path);
    second.recover();
    await second.waitIdle();
    expect(second.adapter.calls).toHaveLength(0);
    expect(runOf(second, runId).status).toBe("paused");
    await second.enqueue({ kind: "resume", runId, commandId: "resume-1" });
    await second.waitIdle();
    expect(second.adapter.calls).toHaveLength(1);
    expect(runOf(second, runId).status).toBe("completed");
    second.stop();
    second.db.close();
  });

  it("keeps a cancelled run dead when a late response arrives", async () => {
    const host = createTestHost({ afterCommit: haltWhenExternalRequested });
    const started = await startRun(host, {
      artifactId: "power-alert",
      input: { power: 1400 },
    });
    const runId = started.runId!;
    const effect = outboxOf(host, runId)[0];
    await host.enqueue({ kind: "cancel", runId, commandId: "cancel-1" });
    await host.waitIdle();
    await host.enqueue({
      kind: "core_command",
      runId,
      command: {
        type: "effect.resolved",
        commandId: "late-1",
        effectId: effect!.effectId,
        response: { source: "live", status: "succeeded", value: { accepted: true } },
      },
    });
    await host.waitIdle();
    expect(runOf(host, runId).status).toBe("cancelled");
    expect(host.adapter.calls).toHaveLength(0);
    expect(eventsOf(host, runId).some((event) => event.type === "effect.lateResult")).toBe(true);
    host.stop();
    host.db.close();
  });

  it("does not auto-step a manual run after restart", async () => {
    const first = createTestHost();
    const started = await startRun(first, {
      artifactId: "power-alert",
      input: { power: 1400 },
      mode: "manual",
    });
    const runId = started.runId!;
    expect(runOf(first, runId).snapshot.state.readyQueue).toEqual(["input"]);
    expect(runOf(first, runId).lastEventSeq).toBeGreaterThan(0);
    first.stop();
    first.db.close();

    const second = reopenHost(first.path);
    second.recover();
    await second.waitIdle();
    expect(runOf(second, runId).snapshot.state.readyQueue).toEqual(["input"]);
    expect(runOf(second, runId).progressionMode).toBe("manual");
    expect(second.adapter.calls).toHaveLength(0);
    await second.enqueue({ kind: "step", runId, commandId: "step-1" });
    await second.waitIdle();
    expect(runOf(second, runId).snapshot.state.nodes.input?.status).toBe("completed");
    expect(runOf(second, runId).snapshot.state.readyQueue).toEqual(["mean"]);
    second.stop();
    second.db.close();
  });
});
