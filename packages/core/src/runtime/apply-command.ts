/**
 * 외부 command 반영.
 * 동일 commandId+digest는 no-op, 충돌은 거부, cancel 뒤 늦은 결과는 lateResult만 남긴다.
 */
import type { EngineCommand } from "../contracts/command.js";
import type { CompiledWorkflow } from "../contracts/compiled.js";
import { diagnostic } from "../contracts/diagnostic.js";
import type { TransitionResult } from "../contracts/engine.js";
import type { ExecutionState } from "../contracts/state.js";
import { commandDigest } from "../effects/digest.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import { createCollector, emit, sealEvents } from "./event-log.js";
import { finalizeStatus } from "./finalize-status.js";
import { resumeWaitingNode } from "./resume-node.js";

export const applyCommand = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  state: ExecutionState,
  command: EngineCommand,
): TransitionResult => {
  const digest = commandDigest(command);
  const previous = state.commandDigests[command.commandId];
  if (previous !== undefined) {
    if (previous === digest) {
      return { ok: true, transition: { state, events: [], effects: [] } };
    }
    return {
      ok: false,
      state,
      diagnostics: [diagnostic("INVALID_COMMAND", "commandId already applied with a different payload")],
    };
  }
  const collector = createCollector(state);
  const applied = applyFresh(registry, plan, state, collector, command);
  if (!applied.ok) {
    return applied;
  }
  const recorded: ExecutionState = {
    ...applied.transition.state,
    appliedCommandIds: [...applied.transition.state.appliedCommandIds, command.commandId],
    commandDigests: {
      ...applied.transition.state.commandDigests,
      [command.commandId]: digest,
    },
  };
  const finalized = finalizeStatus(recorded, collector);
  // pause·cancel 중 새로 생긴 intent는 상태에 requested로만 두고 전달 배열에는 넣지 않는다.
  const publishEffects = finalized.paused || finalized.cancelled ? [] : applied.transition.effects;
  return {
    ok: true,
    transition: {
      state: sealEvents(finalized, collector),
      events: collector.events,
      effects: publishEffects,
    },
  };
};

const applyFresh = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: ReturnType<typeof createCollector>,
  command: EngineCommand,
): TransitionResult => {
  if (command.type === "run.pause") {
    return { ok: true, transition: { state: { ...state, paused: true }, events: [], effects: [] } };
  }
  if (command.type === "run.resume") {
    if (state.cancelled) {
      return reject(state, "cancelled run cannot resume");
    }
    const next = { ...state, paused: false, status: "running" as const };
    emit(collector, next, { type: "run.resumed", status: "running" });
    return { ok: true, transition: { state: next, events: [], effects: [] } };
  }
  if (command.type === "run.cancel") {
    return {
      ok: true,
      transition: { state: { ...state, cancelled: true, readyQueue: [] }, events: [], effects: [] },
    };
  }
  if (command.type === "clock.advanced") {
    if (command.logicalTime < state.logicalTime) {
      return reject(state, "logical time cannot move backwards");
    }
    return {
      ok: true,
      transition: { state: { ...state, logicalTime: command.logicalTime }, events: [], effects: [] },
    };
  }
  if (command.type === "effect.dispatchStarted") {
    return applyDispatch(state, collector, command.effectId);
  }
  return applyResolved(registry, plan, state, collector, command.effectId, command.response);
};

const reject = (state: ExecutionState, message: string): TransitionResult => ({
  ok: false,
  state,
  diagnostics: [diagnostic("INVALID_COMMAND", message)],
});

const applyDispatch = (
  state: ExecutionState,
  collector: ReturnType<typeof createCollector>,
  effectId: string,
): TransitionResult => {
  const effect = state.effects[effectId];
  if (effect === undefined) {
    return reject(state, `unknown effect ${effectId}`);
  }
  if (effect.status !== "requested") {
    return { ok: true, transition: { state, events: [], effects: [] } };
  }
  const next = {
    ...state,
    effects: { ...state.effects, [effectId]: { ...effect, status: "dispatchStarted" as const } },
  };
  emit(collector, next, { type: "effect.dispatchStarted", effectId, nodeId: effect.nodeId });
  return { ok: true, transition: { state: next, events: [], effects: [] } };
};

const applyResolved = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: ReturnType<typeof createCollector>,
  effectId: string,
  response: import("../contracts/effect.js").EffectResponse,
): TransitionResult => {
  const effect = state.effects[effectId];
  if (effect === undefined) {
    return reject(state, `unknown effect ${effectId}`);
  }
  if (effect.status === "resolved") {
    const same = JSON.stringify(effect.response) === JSON.stringify(response);
    return same
      ? { ok: true, transition: { state, events: [], effects: [] } }
      : reject(state, "resolved effect cannot change");
  }
  if (state.cancelled) {
    emit(collector, state, {
      type: "effect.lateResult",
      effectId,
      nodeId: effect.nodeId,
      response,
    });
    return { ok: true, transition: { state, events: [], effects: [] } };
  }
  // unknown은 resume을 호출하지 않는다. 확인된 성공·실패가 오면 그때 재개한다.
  if (response.status === "unknown") {
    const next = {
      ...state,
      effects: {
        ...state.effects,
        [effectId]: { ...effect, status: "unknown" as const, response },
      },
    };
    emit(collector, next, { type: "effect.unknown", effectId, nodeId: effect.nodeId, response });
    return { ok: true, transition: { state: next, events: [], effects: [] } };
  }
  const next = {
    ...state,
    effects: {
      ...state.effects,
      [effectId]: { ...effect, status: "resolved" as const, response },
    },
  };
  emit(collector, next, { type: "effect.resolved", effectId, nodeId: effect.nodeId, response });
  if (state.nodes[effect.nodeId]?.status !== "waiting") {
    return { ok: true, transition: { state: next, events: [], effects: [] } };
  }
  const resumed = resumeWaitingNode(registry, plan, next, collector, effect.nodeId, response);
  return { ok: true, transition: { state: resumed.state, events: [], effects: resumed.effects } };
};
