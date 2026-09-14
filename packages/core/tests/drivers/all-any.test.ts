/** ALL은 두 입력을 모으고, ANY는 fixture 순서로 승자를 고른다. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDryRunDriver } from "../../src/drivers/dry-run.js";
import type { WorkflowDefinition } from "../../src/contracts/index.js";
import { compileOrThrow, engine, startOrThrow } from "../helpers.js";

const definition = (): WorkflowDefinition =>
  JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../examples/all-any.json"), "utf8"),
  ) as WorkflowDefinition;

const anyDefinition = (): WorkflowDefinition => {
  const all = definition();
  return {
    ...all,
    id: "any-demo",
    nodes: all.nodes.map((item) => {
      if (item.id === "join") {
        return { ...item, type: "core.any" };
      }
      if (item.id === "mapped") {
        return {
          ...item,
          inputs: {
            source: { kind: "output", nodeId: "join", output: "source" },
            value: { kind: "output", nodeId: "join", output: "value" },
          },
        };
      }
      return item;
    }),
  };
};

const fixtures = (order: ("a" | "b")[]) => [
  {
    nodeId: "lookupA",
    index: 0,
    adapter: "test.lookup",
    operation: "a",
    order: order.indexOf("a"),
    response: { source: "fixture" as const, status: "succeeded" as const, value: "A" },
  },
  {
    nodeId: "lookupB",
    index: 0,
    adapter: "test.lookup",
    operation: "b",
    order: order.indexOf("b"),
    response: { source: "fixture" as const, status: "succeeded" as const, value: "B" },
  },
];

describe("ALL and ANY examples", () => {
  it("waits for both ALL inputs and maps the combined values", () => {
    const plan = compileOrThrow(definition());
    const result = engine.run(
      plan,
      startOrThrow(plan, {}),
      createDryRunDriver({ fixtures: fixtures(["a", "b"]) }),
    );
    expect(result.status).toBe("terminal");
    expect(result.state.outputs.join).toEqual({ values: { a: "A", b: "B" } });
  });

  it("lets ANY proceed with the first resolved input while the rest finish", () => {
    const plan = compileOrThrow(anyDefinition());
    const bFirst = engine.run(
      plan,
      startOrThrow(plan, {}),
      createDryRunDriver({ fixtures: fixtures(["b", "a"]) }),
    );
    expect(bFirst.state.outputs.join).toEqual({ source: "b", value: "B" });
    expect(bFirst.state.nodes.lookupA?.status).toBe("completed");
    const aFirst = engine.run(
      plan,
      startOrThrow(plan, {}),
      createDryRunDriver({ fixtures: fixtures(["a", "b"]) }),
    );
    expect(aFirst.state.outputs.join).toEqual({ source: "a", value: "A" });
  });

  it("keeps the run waiting when one ALL fixture is missing", () => {
    const plan = compileOrThrow(definition());
    const result = engine.run(
      plan,
      startOrThrow(plan, {}),
      createDryRunDriver({ fixtures: fixtures(["a", "b"]).slice(0, 1) }),
    );
    expect(result.status).toBe("needs-input");
    expect(result.state.nodes.join?.status).toBe("idle");
  });
});
