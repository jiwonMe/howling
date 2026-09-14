/** 다음 예정 timer·fixture 시각으로만 논리 시간을 전진한다. 뒤로 돌리지 않는다. */
import type { EngineCommand } from "../contracts/command.js";
import type { ExecutionState } from "../contracts/state.js";
import type { EffectFixture } from "./fixtures.js";

export const nextClockAdvance = (
  state: ExecutionState,
  fixtures: readonly EffectFixture[],
): EngineCommand | undefined => {
  const times: number[] = [];
  for (const effect of Object.values(state.effects)) {
    if (effect.status !== "requested" && effect.status !== "unknown") {
      continue;
    }
    if (effect.intent.kind === "timer" && effect.intent.dueAt > state.logicalTime) {
      times.push(effect.intent.dueAt);
    }
    const fixture = fixtures.find(
      (item) => item.nodeId === effect.nodeId && item.index === effect.index && item.at !== undefined,
    );
    if (fixture?.at !== undefined && fixture.at > state.logicalTime) {
      times.push(fixture.at);
    }
  }
  const next = times.sort((left, right) => left - right)[0];
  if (next === undefined) {
    return undefined;
  }
  return {
    type: "clock.advanced",
    commandId: `clock:${state.runId}:${next}`,
    logicalTime: next,
  };
};
