/**
 * 노드 결과를 상태에 반영한다.
 * complete는 정상 출력만 게시하고, fail은 error 포트가 있으면 routed로 넘긴다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import type { CoreError } from "../contracts/error.js";
import type { NodeOutcome } from "../contracts/node.js";
import type { EffectRequest } from "../contracts/effect.js";
import type { ExecutionState, NodeRuntimeStatus } from "../contracts/state.js";
import { cloneJson } from "../json/clone.js";
import { ERROR_OUTPUT, ERROR_PORT } from "../nodes/reserved.js";
import { outgoingOnPort, setEdgeStatus, successPorts } from "./edge-status.js";
import type { EventCollector } from "./event-log.js";
import { emit } from "./event-log.js";
import { failOutgoing, refreshIdleNodes, skipOutgoing } from "./propagate.js";
import { effectId } from "../effects/id.js";

export interface OutcomeApply {
  readonly state: ExecutionState;
  readonly effects: EffectRequest[];
}

const withNodeStatus = (
  state: ExecutionState,
  nodeId: string,
  status: NodeRuntimeStatus,
  extra?: Partial<ExecutionState["nodes"][string]>,
): ExecutionState => ({
  ...state,
  nodes: {
    ...state.nodes,
    [nodeId]: { ...state.nodes[nodeId]!, status, ...extra },
  },
  readyQueue: state.readyQueue.filter((id) => id !== nodeId),
});

export const applyComplete = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
  outcome: Extract<NodeOutcome, { kind: "complete" }>,
): OutcomeApply => {
  const node = plan.nodes[nodeId];
  const declared = new Set(successPorts(plan, nodeId));
  // 선언되지 않은 포트 활성화는 노드 실패다. error 포트는 activate로 켜지 않는다.
  for (const port of outcome.activate) {
    if (!declared.has(port)) {
      return applyFail(plan, state, collector, nodeId, {
        code: "INVALID_CONTROL_PORT",
        message: `cannot activate undeclared port ${port}`,
      });
    }
  }
  let next = withNodeStatus(state, nodeId, "completed");
  next = {
    ...next,
    outputs: { ...next.outputs, [nodeId]: cloneJson(outcome.outputs) },
    ...(outcome.nextState === undefined
      ? {}
      : {
          proposedState: {
            ...next.proposedState,
            [nodeId]: cloneJson(outcome.nextState),
          },
        }),
  };
  emit(collector, next, {
    type: "node.completed",
    nodeId,
    nodeExecutionId: next.nodes[nodeId]!.executionId,
    status: "completed",
    outputs: outcome.outputs,
    inputs: next.resolvedInputs[nodeId],
    inputBindings: node?.instance.inputs,
  });
  if (outcome.nextState !== undefined) {
    emit(collector, next, { type: "node.stateUpdated", nodeId, nextState: outcome.nextState });
  }
  for (const port of declared) {
    const status = outcome.activate.includes(port) ? "taken" : "skipped";
    for (const edgeId of outgoingOnPort(plan, nodeId, port)) {
      next = setEdgeStatus(next, collector, edgeId, status);
    }
  }
  for (const edgeId of outgoingOnPort(plan, nodeId, ERROR_PORT)) {
    next = setEdgeStatus(next, collector, edgeId, "skipped");
  }
  return { state: refreshIdleNodes(plan, next, collector), effects: [] };
};

export const applyFail = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
  error: CoreError,
): OutcomeApply => {
  const errorEdges = outgoingOnPort(plan, nodeId, ERROR_PORT);
  // 오류 경로가 있으면 정상 포트는 skipped, 원래 오류는 routed로 기록한다.
  const routed = errorEdges.length > 0;
  let next = withNodeStatus(state, nodeId, "failed", {
    error: { code: error.code, message: error.message },
    routedError: routed,
  });
  if (routed) {
    next = {
      ...next,
      outputs: {
        ...next.outputs,
        [nodeId]: {
          [ERROR_OUTPUT]: {
            code: error.code,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
        },
      },
    };
  }
  emit(collector, next, {
    type: "node.failed",
    nodeId,
    nodeExecutionId: next.nodes[nodeId]!.executionId,
    status: "failed",
    error,
    inputs: next.resolvedInputs[nodeId],
  });
  if (routed) {
    for (const port of successPorts(plan, nodeId)) {
      for (const edgeId of outgoingOnPort(plan, nodeId, port)) {
        next = setEdgeStatus(next, collector, edgeId, "skipped");
      }
    }
    for (const edgeId of errorEdges) {
      next = setEdgeStatus(next, collector, edgeId, "taken");
    }
  } else {
    next = failOutgoing(plan, next, collector, nodeId);
  }
  return { state: refreshIdleNodes(plan, next, collector), effects: [] };
};

export const applyWait = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
  outcome: Extract<NodeOutcome, { kind: "wait" }>,
): OutcomeApply => {
  const runtime = state.nodes[nodeId];
  if (runtime === undefined) {
    return applyFail(plan, state, collector, nodeId, {
      code: "UNKNOWN_NODE_TYPE",
      message: "node runtime is missing",
    });
  }
  const index = runtime.effectIndex;
  const id = effectId(state.runId, runtime.executionId, index);
  const request: EffectRequest = {
    id,
    runId: state.runId,
    nodeId,
    index,
    intent: outcome.effect,
  };
  let next = withNodeStatus(state, nodeId, "waiting", { effectIndex: index + 1 });
  next = {
    ...next,
    continuations: { ...next.continuations, [nodeId]: cloneJson(outcome.continuation) },
    effects: {
      ...next.effects,
      [id]: {
        id,
        runId: state.runId,
        nodeId,
        index,
        intent: outcome.effect,
        status: "requested",
      },
    },
  };
  emit(collector, next, {
    type: "node.waiting",
    nodeId,
    nodeExecutionId: runtime.executionId,
    status: "waiting",
  });
  emit(collector, next, {
    type: "effect.requested",
    effectId: id,
    nodeId,
    intent: outcome.effect,
  });
  return { state: next, effects: [request] };
};

export const applySkipNode = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
): ExecutionState => {
  const current = state.nodes[nodeId];
  if (current === undefined || current.status === "skipped") {
    return state;
  }
  const next = withNodeStatus(state, nodeId, "skipped");
  emit(collector, next, {
    type: "node.skipped",
    nodeId,
    nodeExecutionId: current.executionId,
    status: "skipped",
  });
  return refreshIdleNodes(plan, skipOutgoing(plan, next, collector, nodeId), collector);
};
