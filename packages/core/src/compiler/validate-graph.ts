/**
 * DAG·도달 가능성·위상 순위.
 * 준비 큐 순서는 이 topoRank와 nodeId로만 정한다. 좌표는 쓰지 않는다.
 */
import { diagnostic } from "../contracts/diagnostic.js";
import type { WorkflowDefinition } from "../contracts/workflow.js";
import type { CompilerContext, ResolvedNode } from "./types.js";
import { pushDiagnostic } from "./types.js";

export const validateGraph = (
  definition: WorkflowDefinition,
  resolved: Readonly<Record<string, ResolvedNode>>,
  context: CompilerContext,
): Readonly<Record<string, number>> => {
  const outgoing = new Map<string, string[]>();
  for (const nodeId of Object.keys(resolved)) {
    outgoing.set(nodeId, []);
  }
  for (const edge of definition.edges) {
    if (!resolved[edge.source.nodeId] || !resolved[edge.target.nodeId]) {
      continue;
    }
    const list = outgoing.get(edge.source.nodeId) ?? [];
    list.push(edge.target.nodeId);
    outgoing.set(edge.source.nodeId, list);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleNodes = new Set<string>();
  const visit = (nodeId: string): void => {
    if (visited.has(nodeId) || cycleNodes.has(nodeId)) {
      return;
    }
    if (visiting.has(nodeId)) {
      cycleNodes.add(nodeId);
      pushDiagnostic(
        context,
        diagnostic("CYCLE_DETECTED", `cycle detected at node ${nodeId}`, { nodeId }),
      );
      return;
    }
    visiting.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      visit(next);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const nodeId of Object.keys(resolved)) {
    visit(nodeId);
  }
  const reachable = new Set<string>();
  const walk = (nodeId: string): void => {
    if (reachable.has(nodeId) || !resolved[nodeId]) {
      return;
    }
    reachable.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      walk(next);
    }
  };
  walk(definition.entryNodeId);
  for (const nodeId of Object.keys(resolved)) {
    if (!reachable.has(nodeId)) {
      pushDiagnostic(
        context,
        diagnostic("UNREACHABLE_NODE", `node ${nodeId} is not reachable from entry`, { nodeId }),
      );
    }
  }
  return topoRanks(definition, resolved);
};

const topoRanks = (
  definition: WorkflowDefinition,
  resolved: Readonly<Record<string, ResolvedNode>>,
): Readonly<Record<string, number>> => {
  const incomingCount: Record<string, number> = {};
  const outgoing: Record<string, string[]> = {};
  for (const nodeId of Object.keys(resolved)) {
    incomingCount[nodeId] = 0;
    outgoing[nodeId] = [];
  }
  for (const edge of definition.edges) {
    if (!resolved[edge.source.nodeId] || !resolved[edge.target.nodeId]) {
      continue;
    }
    incomingCount[edge.target.nodeId] = (incomingCount[edge.target.nodeId] ?? 0) + 1;
    (outgoing[edge.source.nodeId] ?? []).push(edge.target.nodeId);
  }
  const queue = Object.keys(resolved)
    .filter((nodeId) => incomingCount[nodeId] === 0)
    .sort();
  const ranks: Record<string, number> = {};
  let rank = 0;
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (nodeId === undefined) {
      break;
    }
    ranks[nodeId] = rank;
    rank += 1;
    const nextIds = [...(outgoing[nodeId] ?? [])].sort();
    for (const next of nextIds) {
      incomingCount[next] = (incomingCount[next] ?? 0) - 1;
      if (incomingCount[next] === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }
  return ranks;
};
