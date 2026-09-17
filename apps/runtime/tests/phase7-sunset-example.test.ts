/**
 * contracts의 「일몰 작업실 조명」 본보기가 스펙대로 분기하는지 dry-run으로 확인한다.
 */
import { describe, expect, it } from "vitest";
import { sunsetDeskLightDefinition } from "@howling/contracts";
import type { EffectFixture, WorkflowDefinition } from "@howling/core";
import { storeArtifact } from "../src/store/artifacts.js";
import { createTestHost, runOf, startDryRun } from "./helpers.js";

const readFixture = (nodeId: string, state: string): EffectFixture => ({
  nodeId,
  index: 0,
  response: {
    source: "fixture",
    status: "succeeded",
    value: { state, on: state === "on" ? true : state === "off" ? false : null },
  },
});

const runCase = async (input: {
  readonly switchState: string;
  readonly weather: string;
  readonly offsetMinutes: number;
}) => {
  const host = createTestHost({ seed: false });
  const definition = sunsetDeskLightDefinition("sunset") as unknown as WorkflowDefinition;
  storeArtifact(host.db, { id: "sunset", definition });
  const started = await startDryRun(host, {
    artifactId: "sunset",
    input: { trigger: { kind: "sun", event: "sunset", offsetMinutes: input.offsetMinutes } },
    fixtures: [
      readFixture("readSwitch", input.switchState),
      readFixture("readWeather", input.weather),
    ],
    definition,
  });
  const run = runOf(host, started.runId!);
  const nodes = run.snapshot.state.nodes;
  host.stop();
  host.db.close();
  return {
    status: run.status,
    turnOn: nodes.turnOn?.status,
    darkSky: nodes.darkSky?.status,
    readWeather: nodes.readWeather?.status,
  };
};

describe("phase 7 sunset desk light example", () => {
  it("turns on at sunset when the switch is off, whatever the sky", async () => {
    const clear = await runCase({ switchState: "off", weather: "partlycloudy", offsetMinutes: 0 });
    expect(clear.status).toBe("completed");
    expect(clear.turnOn).toBe("completed");
    expect(clear.darkSky).toBe("skipped");
    const cloudy = await runCase({ switchState: "off", weather: "cloudy", offsetMinutes: 0 });
    expect(cloudy.turnOn).toBe("completed");
  });

  it("turns on 30 minutes early only when the sky is dark", async () => {
    const rainy = await runCase({ switchState: "off", weather: "rainy", offsetMinutes: -30 });
    expect(rainy.turnOn).toBe("completed");
    expect(rainy.darkSky).toBe("completed");
    const partly = await runCase({ switchState: "off", weather: "partlycloudy", offsetMinutes: -30 });
    expect(partly.status).toBe("completed");
    expect(partly.turnOn).toBe("skipped");
  });

  it("skips everything when the switch is already on", async () => {
    const already = await runCase({ switchState: "on", weather: "cloudy", offsetMinutes: -30 });
    expect(already.status).toBe("completed");
    expect(already.readWeather).toBe("skipped");
    expect(already.turnOn).toBe("skipped");
  });
});
