/** core.condition in / notIn: 배열 원소 구조 동등, 배열이 아니면 실패. */
import { describe, expect, it } from "vitest";
import { CONDITION_OPERATORS } from "../../src/nodes/condition.js";
import {
  compileOrThrow,
  drainPure,
  edge,
  node,
  startOrThrow,
  workflow,
} from "../helpers.js";

const membershipPlan = (operator: "in" | "notIn", right: unknown) =>
  compileOrThrow(
    workflow(
      [
        node("input", "core.input"),
        node(
          "cond",
          "core.condition",
          {
            left: { kind: "output", nodeId: "input", output: "value", path: "/weather" },
            right: { kind: "literal", value: right },
          },
          { operator },
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

describe("condition membership", () => {
  it("registers in and notIn as operators", () => {
    expect(CONDITION_OPERATORS).toContain("in");
    expect(CONDITION_OPERATORS).toContain("notIn");
  });

  it("takes the true branch when left is in the right array", () => {
    const plan = membershipPlan("in", ["cloudy", "rainy", "fog"]);
    const state = drainPure(plan, startOrThrow(plan, { weather: "rainy" }));
    expect(state.nodes.yes?.status).toBe("completed");
    expect(state.nodes.no?.status).toBe("skipped");
  });

  it("takes the false branch when left is missing from the array", () => {
    const plan = membershipPlan("in", ["cloudy", "rainy", "fog"]);
    const state = drainPure(plan, startOrThrow(plan, { weather: "partlycloudy" }));
    expect(state.nodes.yes?.status).toBe("skipped");
    expect(state.nodes.no?.status).toBe("completed");
  });

  it("inverts with notIn", () => {
    const plan = membershipPlan("notIn", ["off", "unavailable"]);
    const state = drainPure(plan, startOrThrow(plan, { weather: "on" }));
    expect(state.nodes.yes?.status).toBe("completed");
  });

  it("fails when the right value is not an array", () => {
    const plan = membershipPlan("in", "cloudy");
    const state = drainPure(plan, startOrThrow(plan, { weather: "cloudy" }));
    expect(state.status).toBe("failed");
    expect(state.nodes.cond?.status).toBe("failed");
  });
});
