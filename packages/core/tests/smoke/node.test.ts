/** Node에서 예제 JSON을 끝까지 실행하는 smoke. */
import { describe, expect, it } from "vitest";
import { createDryRunDriver } from "../../src/drivers/dry-run.js";
import { compileOrThrow, engine, powerAlertDefinition, startOrThrow } from "../helpers.js";

describe("node smoke", () => {
  it("runs the power-alert JSON example to completion", () => {
    const plan = compileOrThrow(powerAlertDefinition());
    const result = engine.run(
      plan,
      startOrThrow(plan, { power: 1400 }, {
        initialState: { mean: [800, 900, 1100, 1200] } as never,
      }),
      createDryRunDriver({
        fixtures: [
          {
            nodeId: "notify",
            index: 0,
            response: { source: "fixture", status: "succeeded", value: { accepted: true } },
          },
        ],
      }),
    );
    expect(result.status).toBe("terminal");
    expect(result.state.status).toBe("completed");
  });
});
