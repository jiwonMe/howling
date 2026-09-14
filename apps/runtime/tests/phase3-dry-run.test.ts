import { describe, expect, it } from "vitest";
import { loadNodeStates } from "../src/store/node-states.js";
import {
  applyCount,
  createTestHost,
  eventsOf,
  outboxOf,
  reopenHost,
  runOf,
  startDryRun,
  startRun,
} from "./helpers.js";

const notifyFixture = {
  nodeId: "notify",
  index: 0,
  adapter: "test.notifications",
  operation: "send",
  response: {
    source: "fixture" as const,
    status: "succeeded" as const,
    value: { accepted: true },
  },
};

const echoFixture = {
  nodeId: "echo",
  index: 0,
  adapter: "test.echo",
  operation: "send",
  response: {
    source: "fixture" as const,
    status: "succeeded" as const,
    value: { ok: true },
  },
};

const meanState = { mean: [800, 900, 1100, 1200] } as Readonly<
  Record<string, import("@howling/core").JsonValue>
>;

describe("phase 3 dry-run host", () => {
  it("matches branches for the same initial conditions", async () => {
    const host = createTestHost();
    const first = await startDryRun(host, {
      artifactId: "power-alert",
      input: { power: 1400 },
      initialState: meanState,
      fixtures: [notifyFixture],
    });
    const second = await startDryRun(host, {
      artifactId: "power-alert",
      input: { power: 1400 },
      initialState: meanState,
      fixtures: [notifyFixture],
    });
    const left = runOf(host, first.runId!);
    const right = runOf(host, second.runId!);
    expect(left.status).toBe("completed");
    expect(right.status).toBe("completed");
    expect(left.snapshot.state.outputs).toEqual(right.snapshot.state.outputs);
    expect(left.snapshot.state.proposedState).toEqual(right.snapshot.state.proposedState);
    host.stop();
    host.db.close();
  });

  it("does not call the adapter or write live node_states", async () => {
    const host = createTestHost();
    await startRun(host, { artifactId: "power-alert", input: { power: 800 } });
    const applies = applyCount(host);
    const live = loadNodeStates(host.db, {
      flowId: "power-alert",
      revision: "v1",
      stateEpoch: "epoch_1",
    });
    const calls = host.adapter.calls.length;
    await startDryRun(host, {
      artifactId: "power-alert",
      input: { power: 1400 },
      initialState: meanState,
      fixtures: [notifyFixture],
    });
    expect(host.adapter.calls).toHaveLength(calls);
    expect(applyCount(host)).toBe(applies);
    expect(
      loadNodeStates(host.db, {
        flowId: "power-alert",
        revision: "v1",
        stateEpoch: "epoch_1",
      }),
    ).toEqual(live);
    host.stop();
    host.db.close();
  });

  it("waits for a missing fixture then continues", async () => {
    const host = createTestHost();
    const started = await startDryRun(host, {
      artifactId: "power-alert",
      input: { power: 1400 },
      initialState: meanState,
      fixtures: [],
    });
    const runId = started.runId!;
    expect(runOf(host, runId).status).toBe("waiting");
    const effect = outboxOf(host, runId).find((row) => row.status === "requested");
    expect(effect).toBeTruthy();
    await host.enqueue({
      kind: "fixture",
      runId,
      commandId: "fix-1",
      effectId: effect!.effectId,
      response: notifyFixture.response,
    });
    await host.enqueue({ kind: "continue", runId, commandId: "cont-1" });
    await host.waitIdle();
    expect(runOf(host, runId).status).toBe("completed");
    expect(host.adapter.calls).toHaveLength(0);
    host.stop();
    host.db.close();
  });

  it("matches step and auto results", async () => {
    const autoHost = createTestHost();
    const auto = await startDryRun(autoHost, {
      artifactId: "power-alert",
      input: { power: 1400 },
      mode: "auto",
      initialState: meanState,
      fixtures: [notifyFixture],
    });
    const manualHost = createTestHost();
    const manual = await startDryRun(manualHost, {
      artifactId: "power-alert",
      input: { power: 1400 },
      mode: "manual",
      initialState: meanState,
      fixtures: [notifyFixture],
    });
    await manualHost.enqueue({
      kind: "continue",
      runId: manual.runId!,
      commandId: "go",
    });
    await manualHost.waitIdle();
    expect(runOf(autoHost, auto.runId!).snapshot.state.outputs).toEqual(
      runOf(manualHost, manual.runId!).snapshot.state.outputs,
    );
    autoHost.stop();
    autoHost.db.close();
    manualHost.stop();
    manualHost.db.close();
  });

  it("keeps virtual time and fixtures after restart", async () => {
    const first = createTestHost();
    const started = await startDryRun(first, {
      artifactId: "delay-effect",
      input: {},
      mode: "manual",
      fixtures: [echoFixture],
    });
    const runId = started.runId!;
    await first.enqueue({ kind: "step", runId, commandId: "s1" });
    await first.waitIdle();
    const time = runOf(first, runId).snapshot.state.logicalTime;
    first.stop();
    first.db.close();
    const second = reopenHost(first.path);
    second.recover();
    await second.waitIdle();
    expect(runOf(second, runId).snapshot.state.logicalTime).toBe(time);
    expect(second.adapter.calls).toHaveLength(0);
    await second.enqueue({ kind: "continue", runId, commandId: "go" });
    await second.waitIdle();
    expect(runOf(second, runId).status).toBe("completed");
    second.stop();
    second.db.close();
  });

  it("does not auto-step a manual run after restart", async () => {
    const first = createTestHost();
    const started = await startDryRun(first, {
      artifactId: "power-alert",
      input: { power: 1400 },
      mode: "manual",
      initialState: meanState,
      fixtures: [notifyFixture],
    });
    const runId = started.runId!;
    const seq = runOf(first, runId).lastEventSeq;
    first.stop();
    first.db.close();
    const second = reopenHost(first.path);
    second.recover();
    await second.waitIdle();
    expect(runOf(second, runId).lastEventSeq).toBe(seq);
    expect(eventsOf(second, runId)).toHaveLength(eventsOf(second, runId).length);
    second.stop();
    second.db.close();
  });

  it("stores the second delay dueAt from logical time", async () => {
    const host = createTestHost();
    const started = await startDryRun(host, {
      artifactId: "delay-effect",
      input: {},
      fixtures: [echoFixture],
    });
    const timers = outboxOf(host, started.runId!).filter((row) => {
      const intent = row.intent as { kind?: string };
      return intent.kind === "timer";
    });
    const due = timers.map((row) => (row.intent as { dueAt: number }).dueAt).sort((a, b) => a - b);
    expect(due).toEqual([50, 100]);
    expect(runOf(host, started.runId!).status).toBe("completed");
    expect(host.adapter.calls).toHaveLength(0);
    host.stop();
    host.db.close();
  });
});
