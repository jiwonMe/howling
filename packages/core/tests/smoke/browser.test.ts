/** 브라우저 smoke와 같은 순수 플로를 Node에서 재현한다. */
import { describe, expect, it } from "vitest";
import { createDryRunDriver } from "../../src/drivers/dry-run.js";
import { compileOrThrow, engine, edge, node, startOrThrow, workflow } from "../helpers.js";

describe("browser-equivalent smoke", () => {
  it("imports the engine and runs a fixture-free flow", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node(
            "cond",
            "core.condition",
            {
              left: { kind: "output", nodeId: "input", output: "value", path: "/n" },
              right: { kind: "literal", value: 1 },
            },
            { operator: "gt" },
          ),
        ],
        [edge("e1", ["input", "success"], ["cond", "in"])],
      ),
    );
    const result = engine.run(plan, startOrThrow(plan, { n: 3 }), createDryRunDriver({ fixtures: [] }));
    expect(result.status).toBe("terminal");
    expect(result.state.outputs.cond).toEqual({ result: true });
  });
});
