/**
 * 준비·skip·upstream 실패 판정.
 * ALL은 모든 진입이 pending을 벗어날 때까지 기다리고,
 * ANY는 최초 taken을 승자로 고정한다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import type { EdgeStatus, ExecutionState, NodeRuntimeStatus } from "../contracts/state.js";
import { ERROR_PORT } from "../nodes/reserved.js";
import type { EventCollector } from "./event-log.js";
import { emit } from "./event-log.js";
import { sortReadyQueue } from "./immutable.js";

const inboundStatuses = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): EdgeStatus[] => {
  const ports = plan.incoming[nodeId] ?? {};
  const statuses: EdgeStatus[] = [];
  for (const [port, edgeIds] of Object.entries(ports)) {
    if (port === ERROR_PORT) {
      continue;
    }
    for (const edgeId of edgeIds) {
      const status = state.edges[edgeId];
      if (status !== undefined) {
        statuses.push(status);
      }
    }
  }
  return statuses;
};

export const canSchedule = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): boolean => {
  const node = plan.nodes[nodeId];
  const runtime = state.nodes[nodeId];
  if (node === undefined || runtime === undefined || runtime.status !== "idle") {
    return false;
  }
  if (nodeId === plan.entryNodeId) {
    return false;
  }
  const statuses = inboundStatuses(plan, state, nodeId);
  if (node.join === "all") {
    // pending이 하나라도 있으면 fixture 누락 경로를 성공/skip으로 바꾸지 않는다.
    return statuses.length > 0 && statuses.every((status) => status !== "pending");
  }
  if (node.join === "any") {
    return statuses.includes("taken") || statuses.every((status) => status !== "pending");
  }
  return statuses.length === 1 && statuses[0] === "taken";
};

export const shouldSkip = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): boolean => {
  const node = plan.nodes[nodeId];
  if (node === undefined || state.nodes[nodeId]?.status !== "idle") {
    return false;
  }
  const statuses = inboundStatuses(plan, state, nodeId);
  if (statuses.includes("pending")) {
    return false;
  }
  if (node.join === "all" || node.join === "any") {
    return statuses.length > 0 && statuses.every((status) => status === "skipped");
  }
  return statuses.length === 1 && statuses[0] === "skipped";
};

export const shouldFailUpstream = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): boolean => {
  const node = plan.nodes[nodeId];
  if (node === undefined || state.nodes[nodeId]?.status !== "idle") {
    return false;
  }
  const statuses = inboundStatuses(plan, state, nodeId);
  if (statuses.includes("pending")) {
    return false;
  }
  return statuses.includes("failed");
};

export const enqueueReady = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
): ExecutionState => {
  if (state.readyQueue.includes(nodeId) || state.nodes[nodeId]?.status !== "idle") {
    return state;
  }
  const nodes = {
    ...state.nodes,
    [nodeId]: { ...state.nodes[nodeId]!, status: "ready" as NodeRuntimeStatus },
  };
  const next = {
    ...state,
    nodes,
    readyQueue: sortReadyQueue([...state.readyQueue, nodeId], plan.topoRank),
  };
  emit(collector, next, {
    type: "node.ready",
    nodeId,
    nodeExecutionId: nodes[nodeId]!.executionId,
    status: "ready",
  });
  return next;
};

export const selectAnyWinner = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): ExecutionState => {
  if (state.anyWinners[nodeId] !== undefined) {
    return state;
  }
  const node = plan.nodes[nodeId];
  if (node === undefined) {
    return state;
  }
  const taken = node.controlInputs
    .flatMap((port) =>
      (plan.incoming[nodeId]?.[port] ?? []).map((edgeId) => ({ port, edgeId })),
    )
    .filter((item) => state.edges[item.edgeId] === "taken")
    // 같은 전이의 동률은 wall clock이 아니라 고정된 edge ID 순서를 따른다.
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId));
  const winner = taken[0]?.port;
  if (winner === undefined) {
    return state;
  }
  return { ...state, anyWinners: { ...state.anyWinners, [nodeId]: winner } };
};
