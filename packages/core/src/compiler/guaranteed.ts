/**
 * 필수 출력 참조의 정적 가용성.
 * ALL·ANY는 어떤 입력이 건너뛰어질 수 있으므로 선행자의 교집합만 보장한다.
 * 반대 분기·ANY 패배 경로·독립 경로의 직접 참조는 여기서 걸러진다.
 */
import type { WorkflowDefinition } from "../contracts/workflow.js";
import { ERROR_PORT } from "../nodes/reserved.js";
import type { ResolvedNode } from "./types.js";

export interface Availability {
  readonly success: Readonly<Record<string, readonly string[]>>;
  readonly errors: Readonly<Record<string, readonly string[]>>;
}

const intersect = (sets: readonly Set<string>[]): Set<string> => {
  if (sets.length === 0) {
    return new Set();
  }
  const [first, ...rest] = sets;
  if (first === undefined) {
    return new Set();
  }
  return new Set([...first].filter((item) => rest.every((set) => set.has(item))));
};

const predecessors = (
  definition: WorkflowDefinition,
  nodeId: string,
): { nodeId: string; port: string; targetPort: string }[] =>
  definition.edges
    .filter((edge) => edge.target.nodeId === nodeId && edge.target.port !== ERROR_PORT)
    .map((edge) => ({
      nodeId: edge.source.nodeId,
      port: edge.source.port,
      targetPort: edge.target.port,
    }));

export const computeAvailability = (
  definition: WorkflowDefinition,
  resolved: Readonly<Record<string, ResolvedNode>>,
  topoRank: Readonly<Record<string, number>>,
): Availability => {
  const success: Record<string, Set<string>> = {};
  const errors: Record<string, Set<string>> = {};
  const ordered = Object.keys(resolved).sort(
    (left, right) => (topoRank[left] ?? 0) - (topoRank[right] ?? 0),
  );
  for (const nodeId of ordered) {
    const node = resolved[nodeId];
    if (node === undefined) {
      continue;
    }
    success[nodeId] = new Set();
    errors[nodeId] = new Set();
    const incoming = predecessors(definition, nodeId);
    if (nodeId === definition.entryNodeId || incoming.length === 0) {
      continue;
    }
    if (node.join !== undefined) {
      // 합류는 일부 입력이 skipped일 수 있어 선행자 자신을 보장에 넣지 않는다.
      success[nodeId] = intersect(
        incoming.map((item) => new Set(success[item.nodeId] ?? [])),
      );
      continue;
    }
    const [only] = incoming;
    if (only === undefined) {
      continue;
    }
    success[nodeId] = new Set(success[only.nodeId] ?? []);
    if (only.port === ERROR_PORT) {
      errors[nodeId] = new Set([...(errors[only.nodeId] ?? []), only.nodeId]);
    } else {
      success[nodeId].add(only.nodeId);
      errors[nodeId] = new Set(errors[only.nodeId] ?? []);
    }
  }
  return {
    success: Object.fromEntries(
      Object.entries(success).map(([key, value]) => [key, [...value]]),
    ),
    errors: Object.fromEntries(
      Object.entries(errors).map(([key, value]) => [key, [...value]]),
    ),
  };
};

export const joinPortAvailability = (
  definition: WorkflowDefinition,
  availability: Availability,
  joinNodeId: string,
  port: string,
): { success: readonly string[]; errors: readonly string[] } => {
  const edge = definition.edges.find(
    (item) => item.target.nodeId === joinNodeId && item.target.port === port,
  );
  if (edge === undefined) {
    return { success: [], errors: [] };
  }
  const parentSuccess = availability.success[edge.source.nodeId] ?? [];
  const parentErrors = availability.errors[edge.source.nodeId] ?? [];
  if (edge.source.port === ERROR_PORT) {
    return { success: parentSuccess, errors: [...parentErrors, edge.source.nodeId] };
  }
  return { success: [...parentSuccess, edge.source.nodeId], errors: parentErrors };
};
