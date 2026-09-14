/** 상태 복사와 결정적 준비 큐 정렬. 화면 좌표는 쓰지 않는다. */
import type { ExecutionState } from "../contracts/state.js";
import { cloneJson } from "../json/clone.js";

export const cloneState = (state: ExecutionState): ExecutionState =>
  cloneJson(state as unknown as import("../contracts/json.js").JsonValue) as unknown as ExecutionState;

export const sortReadyQueue = (
  nodeIds: readonly string[],
  topoRank: Readonly<Record<string, number>>,
): string[] =>
  [...new Set(nodeIds)].sort((left, right) => {
    const rankDelta = (topoRank[left] ?? 0) - (topoRank[right] ?? 0);
    return rankDelta !== 0 ? rankDelta : left.localeCompare(right);
  });

export const nodeExecutionId = (runId: string, nodeId: string): string =>
  `${runId}:${nodeId}`;
