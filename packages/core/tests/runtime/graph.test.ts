/** 순수 그래프: 분기 skip, ALL 활성 입력, ANY 승자, 오류 경로. */
import { describe, expect, it } from "vitest";
import {
  compileOrThrow,
  drainPure,
  edge,
  node,
  startOrThrow,
  stepOrThrow,
  workflow,
} from "../helpers.js";

describe("pure graph execution", () => {
  it("runs a single path and keeps ready-queue order stable", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node("z", "core.map", { v: { kind: "output", nodeId: "input", output: "value" } }),
          node("a", "core.map", { v: { kind: "output", nodeId: "input", output: "value" } }),
        ],
        [
          edge("e1", ["input", "success"], ["z", "in"]),
          edge("e2", ["input", "success"], ["a", "in"]),
        ],
      ),
    );
    const input = { hello: true };
    let state = startOrThrow(plan, input);
    const first = stepOrThrow(plan, state);
    state = first.state;
    expect(state.readyQueue).toEqual(["a", "z"]);
    state = drainPure(plan, state);
    expect(state.status).toBe("completed");
    expect(state.outputs.a).toEqual({ value: { v: input } });
    expect(input).toEqual({ hello: true });
  });

  it("skips the unused condition branch", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node(
            "cond",
            "core.condition",
            {
              left: { kind: "output", nodeId: "input", output: "value", path: "/ok" },
            },
            { operator: "isTrue" },
          ),
          node("yes", "core.map", { v: { kind: "literal", value: "yes" } }),
          node("no", "core.map", { v: { kind: "literal", value: "no" } }),
        ],
        [
          edge("e1", ["input", "success"], ["cond", "in"]),
          edge("e2", ["cond", "true"], ["yes", "in"]),
          edge("e3", ["cond", "false"], ["no", "in"]),
        ],
      ),
    );
    const state = drainPure(plan, startOrThrow(plan, { ok: true }));
    expect(state.nodes.yes?.status).toBe("completed");
    expect(state.nodes.no?.status).toBe("skipped");
    expect(state.status).toBe("completed");
  });

  it("joins ALL active inputs and skips unused ones", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node(
            "cond",
            "core.condition",
            {
              left: { kind: "output", nodeId: "input", output: "value", path: "/ok" },
            },
            { operator: "isTrue" },
          ),
          node("yes", "core.map", { v: { kind: "literal", value: 1 } }),
          node("no", "core.map", { v: { kind: "literal", value: 2 } }),
          node(
            "join",
            "core.all",
            {
              a: { kind: "output", nodeId: "yes", output: "value" },
              b: { kind: "output", nodeId: "no", output: "value" },
            },
            { inputNames: ["a", "b"] },
          ),
        ],
        [
          edge("e1", ["input", "success"], ["cond", "in"]),
          edge("e2", ["cond", "true"], ["yes", "in"]),
          edge("e3", ["cond", "false"], ["no", "in"]),
          edge("e4", ["yes", "success"], ["join", "a"]),
          edge("e5", ["no", "success"], ["join", "b"]),
        ],
      ),
    );
    const state = drainPure(plan, startOrThrow(plan, { ok: true }));
    expect(state.outputs.join).toEqual({ values: { a: { v: 1 } } });
    expect(state.nodes.no?.status).toBe("skipped");
    expect(state.status).toBe("completed");
  });

  it("selects the first taken ANY input and keeps the winner", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node("a", "core.map", { v: { kind: "literal", value: "A" } }),
          node("b", "core.map", { v: { kind: "literal", value: "B" } }),
          node(
            "join",
            "core.any",
            {
              a: { kind: "output", nodeId: "a", output: "value" },
              b: { kind: "output", nodeId: "b", output: "value" },
            },
            { inputNames: ["a", "b"] },
          ),
        ],
        [
          edge("e1", ["input", "success"], ["a", "in"]),
          edge("e2", ["input", "success"], ["b", "in"]),
          edge("e3", ["a", "success"], ["join", "a"]),
          edge("e4", ["b", "success"], ["join", "b"]),
        ],
      ),
    );
    const state = drainPure(plan, startOrThrow(plan, {}));
    expect(state.anyWinners.join).toBe("a");
    expect(state.outputs.join).toEqual({ source: "a", value: { v: "A" } });
    expect(state.nodes.b?.status).toBe("completed");
  });

  it("routes errors and can fail again on the error path", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node(
            "cond",
            "core.condition",
            {
              left: { kind: "output", nodeId: "input", output: "value" },
              right: { kind: "literal", value: 1 },
            },
            { operator: "gt" },
          ),
          node("handler", "core.map", {
            err: { kind: "output", nodeId: "cond", output: "error" },
          }),
        ],
        [
          edge("e1", ["input", "success"], ["cond", "in"]),
          edge("e2", ["cond", "error"], ["handler", "in"]),
        ],
      ),
    );
    const state = drainPure(plan, startOrThrow(plan, "nope"));
    expect(state.nodes.cond?.status).toBe("failed");
    expect(state.nodes.cond?.routedError).toBe(true);
    expect(state.nodes.handler?.status).toBe("completed");
    expect(state.status).toBe("completed");
  });
});
