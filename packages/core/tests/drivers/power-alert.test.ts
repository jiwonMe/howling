/** 문서 §13.1 센서 시나리오: 평균 1080, 반대 조건 skip, step과 run 일치. */
import { describe, expect, it } from "vitest";
import { createDryRunDriver } from "../../src/drivers/dry-run.js";
import {
  compileOrThrow,
  engine,
  powerAlertDefinition,
  startOrThrow,
  stepOrThrow,
} from "../helpers.js";

const fixtures = [
  {
    nodeId: "notify",
    index: 0,
    adapter: "test.notifications",
    operation: "send",
    response: {
      source: "fixture" as const,
      status: "succeeded" as const,
      value: { accepted: true },
    },
  },
];

describe("power-alert dry run", () => {
  it("computes the rolling mean and sends a notification", () => {
    const plan = compileOrThrow(powerAlertDefinition());
    const started = startOrThrow(plan, { power: 1400 }, {
      initialState: { mean: [800, 900, 1100, 1200] } as never,
    });
    const result = engine.run(plan, started, createDryRunDriver({ fixtures }));
    expect(result.status).toBe("terminal");
    expect(result.state.outputs.mean).toEqual({ mean: 1080, count: 5 });
    expect(result.state.proposedState.mean).toEqual([800, 900, 1100, 1200, 1400]);
    expect(result.state.nodes.notify?.status).toBe("completed");
    expect(result.state.outputs.notify).toEqual({ result: { accepted: true } });
    expect(started.initialState.mean).toEqual([800, 900, 1100, 1200]);
  });

  it("skips notify when the average stays under the threshold", () => {
    const plan = compileOrThrow(powerAlertDefinition());
    const started = startOrThrow(plan, { power: 500 }, {
      initialState: { mean: [800, 900, 1100, 1200] } as never,
    });
    const result = engine.run(plan, started, createDryRunDriver({ fixtures }));
    expect(result.state.outputs.mean).toEqual({ mean: 900, count: 5 });
    expect(result.state.nodes.notify?.status).toBe("skipped");
    expect(result.status).toBe("terminal");
  });

  it("matches step replay with automatic run", () => {
    const plan = compileOrThrow(powerAlertDefinition());
    const started = startOrThrow(plan, { power: 1400 }, {
      initialState: { mean: [800, 900, 1100, 1200] } as never,
    });
    let state = started;
    const effects = [];
    for (let index = 0; index < 8; index += 1) {
      const stepped = stepOrThrow(plan, state);
      state = stepped.state;
      effects.push(...stepped.effects);
      if (state.readyQueue.length === 0 && Object.values(state.effects).some((item) => item.status === "requested")) {
        const effect = Object.values(state.effects)[0];
        if (effect === undefined) {
          break;
        }
        const applied = engine.applyCommand(plan, state, {
          type: "effect.resolved",
          commandId: `manual:${effect.id}`,
          effectId: effect.id,
          response: fixtures[0]!.response,
        });
        if (applied.ok) {
          state = applied.transition.state;
        }
      }
    }
    const automatic = engine.run(
      plan,
      startOrThrow(plan, { power: 1400 }, {
        initialState: { mean: [800, 900, 1100, 1200] } as never,
      }),
      createDryRunDriver({ fixtures }),
    );
    expect(state.outputs).toEqual(automatic.state.outputs);
    expect(state.proposedState).toEqual(automatic.state.proposedState);
    expect(state.nodes.notify?.status).toBe(automatic.state.nodes.notify?.status);
  });

  it("waits when a fixture is missing", () => {
    const plan = compileOrThrow(powerAlertDefinition());
    const started = startOrThrow(plan, { power: 1400 }, {
      initialState: { mean: [800, 900, 1100, 1200] } as never,
    });
    const result = engine.run(plan, started, createDryRunDriver({ fixtures: [] }));
    expect(result.status).toBe("needs-input");
    expect(result.state.nodes.notify?.status).toBe("waiting");
  });

  it("rejects live fixture sources in dry-run", () => {
    const plan = compileOrThrow(powerAlertDefinition());
    const started = startOrThrow(plan, { power: 1400 }, {
      initialState: { mean: [800, 900, 1100, 1200] } as never,
    });
    const result = engine.run(
      plan,
      started,
      createDryRunDriver({
        fixtures: [{ ...fixtures[0]!, response: { source: "live", status: "succeeded", value: {} } }],
      }),
    );
    expect(result.status).toBe("needs-input");
  });

  it("round-trips a snapshot in the middle of a run", () => {
    const plan = compileOrThrow(powerAlertDefinition());
    let state = startOrThrow(plan, { power: 1400 }, {
      initialState: { mean: [800, 900, 1100, 1200] } as never,
    });
    state = stepOrThrow(plan, state).state;
    const snap = engine.snapshot(state);
    const restored = engine.restore(plan, snap);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    const result = engine.run(plan, restored.transition.state, createDryRunDriver({ fixtures }));
    expect(result.state.outputs.mean).toEqual({ mean: 1080, count: 5 });
    expect(result.state.nodes.notify?.status).toBe("completed");
  });
});
