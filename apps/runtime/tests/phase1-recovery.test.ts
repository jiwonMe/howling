import { describe, expect, it } from "vitest";
import { createFakeAdapter } from "../src/effects/fake-adapter.js";
import {
  applyCount,
  createTestHost,
  eventsOf,
  haltWhenExternalRequested,
  outboxOf,
  reopenHost,
  runOf,
  startRun,
} from "./helpers.js";

describe("phase 1 crash recovery", () => {
  it("delivers a requested effect once after crash before dispatch", async () => {
    const first = createTestHost({ afterCommit: haltWhenExternalRequested });
    const started = await startRun(first, {
      artifactId: "power-alert",
      input: { power: 1400 },
    });
    expect(started.runId).toBeTruthy();
    expect(first.adapter.calls).toHaveLength(0);
    expect(outboxOf(first, started.runId!).some((row) => row.status === "requested")).toBe(true);
    first.stop();
    first.db.close();

    const adapter = createFakeAdapter();
    const second = reopenHost(first.path, { adapter });
    second.recover();
    await second.waitIdle();
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]?.adapter).toBe("test.notifications");
    expect(runOf(second, started.runId!).status).toBe("completed");
    second.stop();
    second.db.close();
  });

  it("marks dispatchStarted as unknown and does not retry", async () => {
    const adapter = createFakeAdapter(() => ({ kind: "crash" }));
    const first = createTestHost({ adapter });
    const started = await startRun(first, {
      artifactId: "power-alert",
      input: { power: 1400 },
    });
    expect(adapter.calls).toHaveLength(1);
    expect(outboxOf(first, started.runId!).every((row) => row.status === "dispatchStarted")).toBe(
      true,
    );
    first.stop();
    first.db.close();

    const retry = createFakeAdapter();
    const second = reopenHost(first.path, { adapter: retry });
    second.recover();
    await second.waitIdle();
    expect(retry.calls).toHaveLength(0);
    const view = outboxOf(second, started.runId!);
    expect(view.some((row) => row.status === "unknown")).toBe(true);
    expect(runOf(second, started.runId!).status).toBe("waiting");
    second.stop();
    second.db.close();
  });

  it("does not rewrite snapshot, events, or NodeState for a duplicate commandId", async () => {
    const host = createTestHost();
    const started = await startRun(host, {
      artifactId: "power-alert",
      input: { power: 1400 },
    });
    const runId = started.runId!;
    const seq = runOf(host, runId).lastEventSeq;
    const eventCount = eventsOf(host, runId).length;
    const applies = applyCount(host);
    const effect = outboxOf(host, runId)[0];
    expect(effect).toBeTruthy();
    await host.enqueue({
      kind: "core_command",
      runId,
      command: {
        type: "effect.resolved",
        commandId: `resolve:${effect!.effectId}`,
        effectId: effect!.effectId,
        response: { source: "live", status: "succeeded", value: { accepted: true } },
      },
    });
    await host.waitIdle();
    expect(runOf(host, runId).lastEventSeq).toBe(seq);
    expect(eventsOf(host, runId)).toHaveLength(eventCount);
    expect(applyCount(host)).toBe(applies);
    host.stop();
    host.db.close();
  });
});
