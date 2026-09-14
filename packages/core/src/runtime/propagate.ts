/**
 * skip·실패를 하류로 전파하고 idle 노드를 다시 평가한다.
 * 더 이상 활성화될 수 없으면 skipped, 처리되지 않은 상위 오류면 UPSTREAM_FAILED다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import { coreError } from "../contracts/error.js";
import type { ExecutionState, NodeRuntimeStatus } from "../contracts/state.js";
import { ERROR_PORT } from "../nodes/reserved.js";
import { outgoingOnPort, setEdgeStatus, successPorts } from "./edge-status.js";
import type { EventCollector } from "./event-log.js";
import { emit } from "./event-log.js";
import {
  canSchedule,
  enqueueReady,
  selectAnyWinner,
  shouldFailUpstream,
  shouldSkip,
} from "./scheduler.js";

export const skipOutgoing = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
): ExecutionState => {
  let next = state;
  for (const port of plan.nodes[nodeId]?.controlOutputs ?? []) {
    for (const edgeId of outgoingOnPort(plan, nodeId, port)) {
      if (next.edges[edgeId] === "pending") {
        next = setEdgeStatus(next, collector, edgeId, "skipped");
      }
    }
  }
  return next;
};

export const failOutgoing = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
): ExecutionState => {
  let next = state;
  for (const port of successPorts(plan, nodeId)) {
    for (const edgeId of outgoingOnPort(plan, nodeId, port)) {
      if (next.edges[edgeId] === "pending") {
        next = setEdgeStatus(next, collector, edgeId, "failed");
      }
    }
  }
  for (const edgeId of outgoingOnPort(plan, nodeId, ERROR_PORT)) {
    if (next.edges[edgeId] === "pending") {
      next = setEdgeStatus(next, collector, edgeId, "skipped");
    }
  }
  return next;
};

const markNode = (
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
  status: NodeRuntimeStatus,
  extra?: { error?: { code: string; message: string }; routed?: boolean },
): ExecutionState => {
  const current = state.nodes[nodeId];
  if (current === undefined) {
    return state;
  }
  const nodes = {
    ...state.nodes,
    [nodeId]: {
      ...current,
      status,
      ...(extra?.error === undefined ? {} : { error: extra.error }),
      ...(extra?.routed === undefined ? {} : { routedError: extra.routed }),
    },
  };
  const next = { ...state, nodes, readyQueue: state.readyQueue.filter((id) => id !== nodeId) };
  if (status === "skipped") {
    emit(collector, next, {
      type: "node.skipped",
      nodeId,
      nodeExecutionId: current.executionId,
      status,
    });
  }
  if (status === "failed") {
    emit(collector, next, {
      type: "node.failed",
      nodeId,
      nodeExecutionId: current.executionId,
      status,
      ...(extra?.error === undefined ? {} : { error: extra.error }),
    });
  }
  return next;
};

export const refreshIdleNodes = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
): ExecutionState => {
  let next = state;
  let changed = true;
  while (changed) {
    changed = false;
    for (const nodeId of Object.keys(plan.nodes)) {
      if (next.nodes[nodeId]?.status !== "idle") {
        continue;
      }
      if (shouldSkip(plan, next, nodeId)) {
        next = markNode(next, collector, nodeId, "skipped");
        next = skipOutgoing(plan, next, collector, nodeId);
        changed = true;
        continue;
      }
      if (shouldFailUpstream(plan, next, nodeId)) {
        const error = coreError("UPSTREAM_FAILED", "upstream path failed");
        next = markNode(next, collector, nodeId, "failed", { error });
        const hasErrorRoute = outgoingOnPort(plan, nodeId, ERROR_PORT).length > 0;
        next = hasErrorRoute
          ? takeErrorRoute(plan, next, collector, nodeId)
          : failOutgoing(plan, next, collector, nodeId);
        changed = true;
        continue;
      }
      if (canSchedule(plan, next, nodeId)) {
        const node = plan.nodes[nodeId];
        if (node?.join === "any") {
          next = selectAnyWinner(plan, next, nodeId);
          if (next.anyWinners[nodeId] === undefined) {
            continue;
          }
        }
        next = enqueueReady(plan, next, collector, nodeId);
        changed = true;
      }
    }
  }
  return next;
};

const takeErrorRoute = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
): ExecutionState => {
  let next = state;
  for (const port of successPorts(plan, nodeId)) {
    for (const edgeId of outgoingOnPort(plan, nodeId, port)) {
      if (next.edges[edgeId] === "pending") {
        next = setEdgeStatus(next, collector, edgeId, "skipped");
      }
    }
  }
  for (const edgeId of outgoingOnPort(plan, nodeId, ERROR_PORT)) {
    if (next.edges[edgeId] === "pending") {
      next = setEdgeStatus(next, collector, edgeId, "taken");
    }
  }
  return next;
};
