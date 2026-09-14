/** effect ID 안정성, unknown 재개, pause, cancel, snapshot 재발행 금지. */
import { describe, expect, it } from "vitest";
import {
  compileOrThrow,
  edge,
  engine,
  node,
  startOrThrow,
  stepOrThrow,
  workflow,
} from "../helpers.js";

const effectFlow = () =>
  compileOrThrow(
    workflow(
      [
        node("input", "core.input"),
        node(
          "notify",
          "core.effect",
          { request: { kind: "literal", value: { ok: true } } },
          { adapter: "test.notifications", operation: "send" },
        ),
      ],
      [edge("e1", ["input", "success"], ["notify", "in"])],
    ),
  );

describe("effects and control", () => {
  it("uses stable effect ids and ignores duplicate matching resolves", () => {
    const plan = effectFlow();
    let state = startOrThrow(plan, {});
    state = stepOrThrow(plan, state).state;
    const waiting = stepOrThrow(plan, state);
    const effect = waiting.effects[0];
    expect(effect && "id" in effect ? effect.id : undefined).toMatch(/run-1:/);
    state = waiting.state;
    const command = {
      type: "effect.resolved" as const,
      commandId: "cmd-1",
      effectId: (effect as { id: string }).id,
      response: { source: "fixture" as const, status: "succeeded" as const, value: { accepted: true } },
    };
    const first = engine.applyCommand(plan, state, command);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const duplicate = engine.applyCommand(plan, first.transition.state, command);
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) {
      expect(duplicate.transition.events).toEqual([]);
    }
    const conflict = engine.applyCommand(plan, first.transition.state, {
      ...command,
      response: { source: "fixture", status: "failed", error: { code: "X", message: "no" } },
    });
    expect(conflict.ok).toBe(false);
  });

  it("does not resume on unknown and later accepts a settled response", () => {
    const plan = effectFlow();
    let state = startOrThrow(plan, {});
    state = stepOrThrow(plan, state).state;
    const waiting = stepOrThrow(plan, state);
    const effectId = (waiting.effects[0] as { id: string }).id;
    const unknown = engine.applyCommand(plan, waiting.state, {
      type: "effect.resolved",
      commandId: "u1",
      effectId,
      response: { source: "fixture", status: "unknown", reason: "timeout" },
    });
    expect(unknown.ok).toBe(true);
    if (!unknown.ok) {
      return;
    }
    expect(unknown.transition.state.nodes.notify?.status).toBe("waiting");
    const settled = engine.applyCommand(plan, unknown.transition.state, {
      type: "effect.resolved",
      commandId: "u2",
      effectId,
      response: { source: "fixture", status: "succeeded", value: { accepted: true } },
    });
    expect(settled.ok).toBe(true);
    if (settled.ok) {
      expect(settled.transition.state.nodes.notify?.status).toBe("completed");
      expect(settled.transition.state.readyQueue).toEqual([]);
    }
  });

  it("accepts responses while paused and does not publish new effects", () => {
    const plan = effectFlow();
    let state = startOrThrow(plan, {});
    state = stepOrThrow(plan, state).state;
    const waiting = stepOrThrow(plan, state);
    const paused = engine.applyCommand(plan, waiting.state, {
      type: "run.pause",
      commandId: "p1",
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok) {
      return;
    }
    const effectId = (waiting.effects[0] as { id: string }).id;
    const resolved = engine.applyCommand(plan, paused.transition.state, {
      type: "effect.resolved",
      commandId: "p2",
      effectId,
      response: { source: "fixture", status: "succeeded", value: { accepted: true } },
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.transition.state.nodes.notify?.status).toBe("completed");
      expect(resolved.transition.state.paused).toBe(true);
    }
  });

  it("records late results after cancel without updating analysis state", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node("mean", "analysis.rolling-mean", {
            value: { kind: "output", nodeId: "input", output: "value", path: "/n" },
          }, { windowSize: 2 }),
        ],
        [edge("e1", ["input", "success"], ["mean", "in"])],
      ),
    );
    let state = startOrThrow(plan, { n: 1 }, {
      initialState: { mean: [9] } as never,
    });
    const cancelled = engine.applyCommand(plan, state, {
      type: "run.cancel",
      commandId: "c1",
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }
    const late = engine.applyCommand(plan, cancelled.transition.state, {
      type: "effect.resolved",
      commandId: "c2",
      effectId: "missing",
      response: { source: "recorded", status: "succeeded", value: 1 },
    });
    expect(late.ok).toBe(false);
    expect(cancelled.transition.state.proposedState.mean).toBeUndefined();
    expect(engine.step(plan, cancelled.transition.state).ok).toBe(false);
  });

  it("restores a snapshot without reissuing effects", () => {
    const plan = effectFlow();
    let state = startOrThrow(plan, {});
    state = stepOrThrow(plan, state).state;
    const waiting = stepOrThrow(plan, state);
    const snap = engine.snapshot(waiting.state);
    const restored = engine.restore(plan, snap);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.transition.effects).toEqual([]);
      expect(Object.keys(restored.transition.state.effects)).toEqual(
        Object.keys(waiting.state.effects),
      );
    }
    const bad = engine.restore(
      { ...plan, fingerprint: "deadbeefdeadbeef" },
      snap,
    );
    expect(bad.ok).toBe(false);
  });
});
