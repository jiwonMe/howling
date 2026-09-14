/** 분석 상태: 실패 노드 미반영, 선행 성공 상태 보존, replay 결정성. */
import { describe, expect, it } from "vitest";
import { createDryRunDriver } from "../../src/drivers/dry-run.js";
import {
  compileOrThrow,
  drainPure,
  edge,
  engine,
  node,
  startOrThrow,
  workflow,
} from "../helpers.js";

describe("analysis state", () => {
  it("keeps successful proposed state when a later node fails", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node(
            "mean",
            "analysis.rolling-mean",
            { value: { kind: "output", nodeId: "input", output: "value", path: "/n" } },
            { windowSize: 3 },
          ),
          node(
            "cond",
            "core.condition",
            {
              left: { kind: "literal", value: "x" },
              right: { kind: "literal", value: 1 },
            },
            { operator: "gt" },
          ),
        ],
        [
          edge("e1", ["input", "success"], ["mean", "in"]),
          edge("e2", ["mean", "success"], ["cond", "in"]),
        ],
      ),
    );
    const initial = { mean: [1, 2] };
    const state = drainPure(plan, startOrThrow(plan, { n: 3 }, { initialState: initial }));
    expect(state.nodes.mean?.status).toBe("completed");
    expect(state.nodes.cond?.status).toBe("failed");
    expect(state.status).toBe("failed");
    expect(state.proposedState.mean).toEqual([1, 2, 3]);
    expect(initial.mean).toEqual([1, 2]);
  });

  it("does not apply state from a failed node", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node(
            "mean",
            "analysis.rolling-mean",
            { value: { kind: "output", nodeId: "input", output: "value", path: "/n" } },
            { windowSize: 3 },
          ),
        ],
        [edge("e1", ["input", "success"], ["mean", "in"])],
      ),
    );
    const state = drainPure(
      plan,
      startOrThrow(plan, { n: "bad" }, { initialState: { mean: [1, 2] } }),
    );
    expect(state.nodes.mean?.status).toBe("failed");
    expect(state.proposedState.mean).toBeUndefined();
  });

  it("replays the same dry-run bundle to the same result", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node(
            "wait",
            "core.effect",
            { request: { kind: "literal", value: 1 } },
            { adapter: "test", operation: "echo" },
          ),
        ],
        [edge("e1", ["input", "success"], ["wait", "in"])],
      ),
    );
    const driver = createDryRunDriver({
      fixtures: [
        {
          nodeId: "wait",
          index: 0,
          response: { source: "fixture", status: "succeeded", value: 7 },
        },
      ],
    });
    const first = engine.run(plan, startOrThrow(plan, {}), driver);
    const second = engine.run(plan, startOrThrow(plan, {}), driver);
    expect(first.state.outputs).toEqual(second.state.outputs);
    expect(first.state.status).toEqual(second.state.status);
    expect(Object.keys(first.state.effects)).toEqual(Object.keys(second.state.effects));
  });
});
