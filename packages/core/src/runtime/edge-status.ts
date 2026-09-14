/** 엣지 해소와 이벤트. 같은 전이에 여러 엣지가 있으면 ID 순으로 이미 정렬되어 있다. */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import type { EdgeStatus, ExecutionState } from "../contracts/state.js";
import type { EventCollector } from "./event-log.js";
import { emit } from "./event-log.js";
import { ERROR_PORT } from "../nodes/reserved.js";

export const setEdgeStatus = (
  state: ExecutionState,
  collector: EventCollector,
  edgeId: string,
  status: EdgeStatus,
): ExecutionState => {
  if (state.edges[edgeId] === status) {
    return state;
  }
  const next: ExecutionState = {
    ...state,
    edges: { ...state.edges, [edgeId]: status },
  };
  const type =
    status === "taken" ? "edge.taken" : status === "failed" ? "edge.failed" : "edge.skipped";
  emit(collector, next, { type, edgeId, status });
  return next;
};

export const outgoingOnPort = (
  plan: CompiledWorkflow,
  nodeId: string,
  port: string,
): readonly string[] => plan.outgoing[nodeId]?.[port] ?? [];

export const successPorts = (
  plan: CompiledWorkflow,
  nodeId: string,
): readonly string[] =>
  (plan.nodes[nodeId]?.controlOutputs ?? []).filter((port) => port !== ERROR_PORT);
