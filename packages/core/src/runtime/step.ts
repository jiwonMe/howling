/**
 * 준비 큐 앞 노드 하나를 평가한다.
 * Effect를 만나면 I/O를 기다리지 않고 대기 상태와 intent만 반환한다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import { diagnostic } from "../contracts/diagnostic.js";
import type { TransitionResult } from "../contracts/engine.js";
import type { NodeOutcome } from "../contracts/node.js";
import type { ExecutionState } from "../contracts/state.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import { applyComplete, applyFail, applyWait } from "./apply-outcome.js";
import { createCollector, emit, sealEvents } from "./event-log.js";
import { buildNodeContext, runNodeStart, validateOutputs } from "./evaluate-node.js";
import { finalizeStatus } from "./finalize-status.js";
import { inputNamesForStart, resolveNodeInputs } from "./resolve-inputs.js";

export const stepRun = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  state: ExecutionState,
): TransitionResult => {
  if (state.cancelled) {
    return {
      ok: false,
      state,
      diagnostics: [diagnostic("INVALID_COMMAND", "cancelled run cannot step")],
    };
  }
  // pause 중에는 새 노드를 시작하지 않는다. 진행 중 effect 결과는 applyCommand가 받는다.
  if (state.paused) {
    return { ok: true, transition: { state, events: [], effects: [] } };
  }
  const nodeId = state.readyQueue[0];
  if (nodeId === undefined) {
    const collector = createCollector(state);
    const finalized = finalizeStatus(state, collector);
    return {
      ok: true,
      transition: { state: sealEvents(finalized, collector), events: collector.events, effects: [] },
    };
  }
  const collector = createCollector(state);
  const runtime = state.nodes[nodeId];
  if (runtime === undefined) {
    return {
      ok: false,
      state,
      diagnostics: [diagnostic("INVALID_WORKFLOW", `missing runtime for ${nodeId}`, { nodeId })],
    };
  }
  let next: ExecutionState = {
    ...state,
    nodes: { ...state.nodes, [nodeId]: { ...runtime, status: "running" } },
    readyQueue: state.readyQueue.slice(1),
  };
  emit(collector, next, {
    type: "node.started",
    nodeId,
    nodeExecutionId: runtime.executionId,
    status: "running",
  });
  const names = inputNamesForStart(plan, next, nodeId);
  const resolved = resolveNodeInputs(plan, next, nodeId, names);
  if (!resolved.ok) {
    const failed = applyFail(plan, next, collector, nodeId, {
      code: "INPUT_SCHEMA_MISMATCH",
      message: resolved.diagnostics[0]?.message ?? "input resolution failed",
    });
    return okTransition(failed.state, collector, failed.effects);
  }
  next = {
    ...next,
    resolvedInputs: { ...next.resolvedInputs, [nodeId]: resolved.inputs },
  };
  const context = buildNodeContext(plan, next, nodeId, resolved.inputs);
  if (context === undefined) {
    const failed = applyFail(plan, next, collector, nodeId, {
      code: "UNKNOWN_NODE_TYPE",
      message: "node context could not be built",
    });
    return okTransition(failed.state, collector, failed.effects);
  }
  const outcome = decorateOutcome(plan, nodeId, runNodeStart(registry, plan, context));
  const applied = applyOutcome(registry, plan, next, collector, nodeId, outcome);
  return okTransition(applied.state, collector, applied.effects);
};

const decorateOutcome = (
  plan: CompiledWorkflow,
  nodeId: string,
  outcome: NodeOutcome,
): NodeOutcome => {
  if (outcome.kind !== "complete") {
    return outcome;
  }
  return validateOutputs(plan, nodeId, outcome.outputs) ?? outcome;
};

const applyOutcome = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: ReturnType<typeof createCollector>,
  nodeId: string,
  outcome: NodeOutcome,
) => {
  if (outcome.kind === "complete") {
    return applyComplete(plan, state, collector, nodeId, outcome);
  }
  if (outcome.kind === "fail") {
    return applyFail(plan, state, collector, nodeId, outcome.error);
  }
  const node = plan.nodes[nodeId];
  const registered = node
    ? registry.get(node.instance.type, node.instance.version)
    : undefined;
  if (registered?.implementation.resume === undefined) {
    return applyFail(plan, state, collector, nodeId, {
      code: "INVALID_NODE_CONFIG",
      message: "wait outcome requires a resume implementation",
    });
  }
  return applyWait(plan, state, collector, nodeId, outcome);
};

const okTransition = (
  state: ExecutionState,
  collector: ReturnType<typeof createCollector>,
  effects: readonly import("../contracts/effect.js").EffectRequest[],
): TransitionResult => {
  const finalized = finalizeStatus(state, collector);
  return {
    ok: true,
    transition: {
      state: sealEvents(finalized, collector),
      events: collector.events,
      effects: finalized.paused || finalized.cancelled ? [] : [...effects],
    },
  };
};
