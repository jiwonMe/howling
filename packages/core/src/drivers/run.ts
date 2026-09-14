/**
 * 자동 실행 루프.
 * 준비 노드를 먼저 모두 시작해 여러 effect가 동시에 대기할 수 있게 한 뒤,
 * driver command로 응답·시간을 반영한다. 별도 실행 로직은 없다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import type { DriverRunResult, EngineDriver } from "../contracts/engine.js";
import type { ExecutionEvent } from "../contracts/event.js";
import type { EffectRequest } from "../contracts/effect.js";
import type { ExecutionState } from "../contracts/state.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import { applyCommand } from "../runtime/apply-command.js";
import { stepRun } from "../runtime/step.js";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export const runWithDriver = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  state: ExecutionState,
  driver: EngineDriver,
): DriverRunResult => {
  let current = state;
  const events: ExecutionEvent[] = [];
  const effects: EffectRequest[] = [];
  const reasons: string[] = [];
  for (let guard = 0; guard < 10_000; guard += 1) {
    if (current.paused) {
      return { status: "paused", state: current, events, effects };
    }
    if (TERMINAL.has(current.status)) {
      return { status: "terminal", state: current, events, effects };
    }
    // dry-run 계약: 준비 노드를 처리한 뒤에야 fixture·timer를 반영한다.
    if (current.readyQueue.length > 0) {
      const stepped = stepRun(registry, plan, current);
      if (!stepped.ok) {
        reasons.push(stepped.diagnostics[0]?.message ?? "step failed");
        return { status: "needs-input", state: current, events, effects, waitingReasons: reasons };
      }
      current = stepped.transition.state;
      events.push(...stepped.transition.events);
      effects.push(...stepped.transition.effects);
      continue;
    }
    const commands = driver.nextCommands(plan, current, unreadEffects(current, effects));
    if (commands.length > 0) {
      for (const command of commands) {
        const applied = applyCommand(registry, plan, current, command);
        if (!applied.ok) {
          reasons.push(applied.diagnostics[0]?.message ?? "command rejected");
          return { status: "needs-input", state: current, events, effects, waitingReasons: reasons };
        }
        current = applied.transition.state;
        events.push(...applied.transition.events);
        effects.push(...applied.transition.effects);
      }
      continue;
    }
    if (hasUnresolvedWork(current)) {
      reasons.push(...missingFixtureReasons(current));
      return { status: "needs-input", state: current, events, effects, waitingReasons: reasons };
    }
    return { status: "terminal", state: current, events, effects };
  }
  return {
    status: "needs-input",
    state: current,
    events,
    effects,
    waitingReasons: ["driver iteration limit reached"],
  };
};

const unreadEffects = (
  state: ExecutionState,
  published: readonly EffectRequest[],
): EffectRequest[] =>
  Object.values(state.effects)
    .filter((effect) => effect.status === "requested")
    .filter((effect) => !published.some((item) => item.id === effect.id))
    .map((effect) => ({
      id: effect.id,
      runId: effect.runId,
      nodeId: effect.nodeId,
      index: effect.index,
      intent: effect.intent,
    }));

const hasUnresolvedWork = (state: ExecutionState): boolean =>
  Object.values(state.effects).some(
    (effect) =>
      effect.status === "requested" ||
      effect.status === "dispatchStarted" ||
      effect.status === "unknown",
  ) || Object.values(state.edges).some((status) => status === "pending");

const missingFixtureReasons = (state: ExecutionState): string[] =>
  Object.values(state.effects)
    .filter((effect) => effect.status === "requested" || effect.status === "unknown")
    .map((effect) => `missing fixture for ${effect.nodeId}#${effect.index}`);
