/**
 * run 최종 상태.
 * ANY 하류가 끝나도 남은 effect나 pending 엣지가 있으면 완료로 표시하지 않는다.
 */
import type { ExecutionState, RunStatus } from "../contracts/state.js";
import type { EventCollector } from "./event-log.js";
import { emit } from "./event-log.js";

const ACTIVE: ReadonlySet<string> = new Set(["idle", "ready", "running", "waiting"]);

export const finalizeStatus = (
  state: ExecutionState,
  collector: EventCollector,
): ExecutionState => {
  const nextStatus = deriveStatus(state);
  if (nextStatus === state.status) {
    return state;
  }
  const next = { ...state, status: nextStatus };
  const type =
    nextStatus === "completed"
      ? "run.completed"
      : nextStatus === "failed"
        ? "run.failed"
        : nextStatus === "cancelled"
          ? "run.cancelled"
          : nextStatus === "paused"
            ? "run.paused"
            : nextStatus === "waiting"
              ? "run.waiting"
              : undefined;
  if (type !== undefined) {
    emit(collector, next, { type, status: nextStatus });
  }
  return next;
};

const deriveStatus = (state: ExecutionState): RunStatus => {
  if (state.cancelled) {
    return "cancelled";
  }
  const nodeStatuses = Object.values(state.nodes).map((node) => node.status);
  const active = nodeStatuses.some((status) => ACTIVE.has(status));
  const pendingEdges = Object.values(state.edges).some((status) => status === "pending");
  const waitingEffects = Object.values(state.effects).some(
    (effect) => effect.status === "requested" || effect.status === "dispatchStarted" || effect.status === "unknown",
  );
  if (!active && !pendingEdges && !waitingEffects) {
    const unrouted = Object.values(state.nodes).some(
      (node) => node.status === "failed" && node.routedError !== true,
    );
    return unrouted ? "failed" : "completed";
  }
  if (state.paused) {
    return "paused";
  }
  if (waitingEffects && !state.readyQueue.length) {
    return "waiting";
  }
  return "running";
};
