/** 가상 시간으로 timer를 해소한다. wall clock을 읽지 않는다. */
import { describe, expect, it } from "vitest";
import { createDryRunDriver } from "../../src/drivers/dry-run.js";
import { compileOrThrow, engine, edge, node, startOrThrow, workflow } from "../helpers.js";

describe("virtual time", () => {
  it("resolves timers without reading the wall clock", () => {
    const plan = compileOrThrow(
      workflow(
        [
          node("input", "core.input"),
          node("wait", "core.delay", {}, { durationMs: 50 }),
        ],
        [edge("e1", ["input", "success"], ["wait", "in"])],
      ),
    );
    const result = engine.run(plan, startOrThrow(plan, {}, { logicalTime: 1000 }), createDryRunDriver({ fixtures: [] }));
    expect(result.status).toBe("terminal");
    expect(result.state.logicalTime).toBe(1050);
    expect(result.state.outputs.wait).toEqual({ elapsedMs: 50 });
  });
});
