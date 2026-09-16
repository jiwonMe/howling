/**
 * 제어 엣지 id는 source·port·target을 쓰고, 같은 경로는 한 번만 둔다.
 * 합류 노드는 이름 포트마다 들어오는 선을 하나씩 받는다.
 */
import type { WorkflowDefinition } from "@howling/core";
import { isJoinType, joinNamesOf, outputOf } from "./flow-ports.js";

export const sourcePort = (type: string): string =>
  type === "core.condition" ? "true" : "success";

type ControlEdge = WorkflowDefinition["edges"][number];

export const sameRoute = (left: ControlEdge, right: ControlEdge): boolean =>
  left.source.nodeId === right.source.nodeId &&
  left.source.port === right.source.port &&
  left.target.nodeId === right.target.nodeId &&
  left.target.port === right.target.port;

export const edgeIdFor = (
  sourceId: string,
  port: string,
  targetId: string,
  existing: readonly ControlEdge[],
): string => {
  const base = `e-${sourceId}-${port}-${targetId}`;
  if (!existing.some((edge) => edge.id === base)) {
    return base;
  }
  let index = 2;
  while (existing.some((edge) => edge.id === `${base}-${String(index)}`)) {
    index += 1;
  }
  return `${base}-${String(index)}`;
};

const inboundKey = (definition: WorkflowDefinition, edge: ControlEdge): string => {
  const target = definition.nodes.find((node) => node.id === edge.target.nodeId);
  return target && isJoinType(target.type)
    ? `${edge.target.nodeId}:${edge.target.port}`
    : edge.target.nodeId;
};

const nextJoinPort = (
  definition: WorkflowDefinition,
  targetId: string,
  requested?: string,
): string | undefined => {
  const target = definition.nodes.find((node) => node.id === targetId);
  if (!target || !isJoinType(target.type)) {
    return requested ?? "in";
  }
  const names = joinNamesOf(target.config);
  const used = new Set(
    definition.edges
      .filter((edge) => edge.target.nodeId === targetId)
      .map((edge) => edge.target.port),
  );
  if (requested && names.includes(requested) && !used.has(requested)) {
    return requested;
  }
  if (requested && names.includes(requested) && used.has(requested)) {
    return undefined;
  }
  return names.find((name) => !used.has(name));
};

export const connectEdge = (
  definition: WorkflowDefinition,
  input: {
    readonly sourceId: string;
    readonly sourcePort?: string;
    readonly targetId: string;
    readonly targetPort?: string;
  },
): WorkflowDefinition => {
  const source = definition.nodes.find((node) => node.id === input.sourceId);
  const port = input.sourcePort ?? sourcePort(source?.type ?? "");
  const targetPort = nextJoinPort(definition, input.targetId, input.targetPort);
  if (!targetPort) {
    return definition;
  }
  const next: ControlEdge = {
    id: edgeIdFor(input.sourceId, port, input.targetId, definition.edges),
    source: { nodeId: input.sourceId, port },
    target: { nodeId: input.targetId, port: targetPort },
  };
  if (definition.edges.some((edge) => sameRoute(edge, next))) {
    return definition;
  }
  const target = definition.nodes.find((node) => node.id === input.targetId);
  if (
    !(target && isJoinType(target.type)) &&
    definition.edges.some((edge) => edge.target.nodeId === next.target.nodeId)
  ) {
    return definition;
  }
  return { ...definition, edges: [...definition.edges, next] };
};

export const connectEdgeWithBinding = (
  definition: WorkflowDefinition,
  input: Parameters<typeof connectEdge>[1],
): WorkflowDefinition => {
  const next = connectEdge(definition, input);
  if (next.edges.length === definition.edges.length) {
    return next;
  }
  const added = next.edges[next.edges.length - 1];
  const target = added
    ? next.nodes.find((node) => node.id === added.target.nodeId)
    : undefined;
  const source = added
    ? next.nodes.find((node) => node.id === added.source.nodeId)
    : undefined;
  if (!added || !target || !source || !isJoinType(target.type) || target.inputs[added.target.port]) {
    return next;
  }
  return {
    ...next,
    nodes: next.nodes.map((node) =>
      node.id !== target.id
        ? node
        : {
            ...node,
            inputs: {
              ...node.inputs,
              [added.target.port]: {
                kind: "output" as const,
                nodeId: source.id,
                output: outputOf(source.type),
              },
            },
          },
    ),
  };
};

const preferInbound = (left: ControlEdge, right: ControlEdge): ControlEdge =>
  right.source.port === "true" && left.source.port !== "true" ? right : left;

export const repairEdges = (definition: WorkflowDefinition): WorkflowDefinition => {
  const unique: ControlEdge[] = [];
  for (const edge of definition.edges) {
    const target = definition.nodes.find((node) => node.id === edge.target.nodeId);
    if (target && isJoinType(target.type) && !joinNamesOf(target.config).includes(edge.target.port)) {
      continue;
    }
    if (unique.some((item) => sameRoute(item, edge))) {
      continue;
    }
    if (!unique.some((item) => item.id === edge.id)) {
      unique.push(edge);
      continue;
    }
    unique.push({
      ...edge,
      id: edgeIdFor(edge.source.nodeId, edge.source.port, edge.target.nodeId, unique),
    });
  }
  const inbound = new Map<string, ControlEdge>();
  for (const edge of unique) {
    const key = inboundKey(definition, edge);
    const current = inbound.get(key);
    inbound.set(key, current ? preferInbound(current, edge) : edge);
  }
  return { ...definition, edges: [...inbound.values()] };
};
