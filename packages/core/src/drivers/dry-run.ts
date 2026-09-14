/**
 * fixture 전용 driver.
 * source: live 응답은 성공·실패와 무관하게 거부하고 실제 adapter를 받지 않는다.
 */
import type { EngineCommand } from "../contracts/command.js";
import type { CompiledWorkflow } from "../contracts/compiled.js";
import type { EffectRequest } from "../contracts/effect.js";
import type { EngineDriver } from "../contracts/engine.js";
import type { ExecutionState } from "../contracts/state.js";
import type { EffectFixture } from "./fixtures.js";
import { matchFixture } from "./fixtures.js";
import { nextClockAdvance } from "./virtual-clock.js";

export interface DryRunDriverOptions {
  readonly fixtures: readonly EffectFixture[];
}

/** dry-run에 live 출처를 섞으면 안 된다. */
const rejectLive = (response: EffectFixture["response"]): boolean => response.source === "live";

export const createDryRunDriver = (options: DryRunDriverOptions): EngineDriver => ({
  nextCommands: (plan, state, effects) =>
    collectCommands(plan, state, effects, options.fixtures),
});

const collectCommands = (
  _plan: CompiledWorkflow,
  state: ExecutionState,
  effects: readonly EffectRequest[],
  fixtures: readonly EffectFixture[],
): EngineCommand[] => {
  const commands: EngineCommand[] = [];
  const clock = nextClockAdvance(state, fixtures);
  if (clock !== undefined) {
    commands.push(clock);
  }
  const pending = [
    ...effects,
    ...Object.values(state.effects)
      .filter((effect) => effect.status === "requested" || effect.status === "unknown")
      .map((effect) => ({
        id: effect.id,
        runId: effect.runId,
        nodeId: effect.nodeId,
        index: effect.index,
        intent: effect.intent,
      })),
  ];
  const unique = new Map(pending.map((effect) => [effect.id, effect]));
  for (const request of unique.values()) {
    if (request.intent.kind !== "timer" || request.intent.dueAt > state.logicalTime) {
      continue;
    }
    commands.push({
      type: "effect.resolved",
      commandId: `timer:${request.id}`,
      effectId: request.id,
      response: { source: "simulated", status: "succeeded", value: { dueAt: request.intent.dueAt } },
    });
  }
  const due = [...unique.values()]
    .map((request) => {
      const fixture = fixtures.find(
        (item) => item.nodeId === request.nodeId && item.index === request.index,
      );
      return { request, fixture };
    })
    .filter((item) => item.fixture !== undefined)
    .sort((left, right) => (left.fixture?.order ?? 0) - (right.fixture?.order ?? 0));
  for (const { request, fixture } of due) {
    if (fixture === undefined) {
      continue;
    }
    if (fixture.at !== undefined && fixture.at > state.logicalTime) {
      continue;
    }
    if (request.intent.kind === "timer" && request.intent.dueAt > state.logicalTime) {
      continue;
    }
    if (rejectLive(fixture.response)) {
      continue;
    }
    const matched = matchFixture(request, fixture);
    if (!matched.ok) {
      continue;
    }
    commands.push({
      type: "effect.resolved",
      commandId: `fixture:${request.id}`,
      effectId: request.id,
      response: fixture.response,
    });
  }
  return commands;
};
