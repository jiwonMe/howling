/**
 * 제어 엣지 id는 source·port·target을 쓰고, 같은 경로는 한 번만 둔다.
 */
import type { WorkflowDefinition } from "@howling/core";

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
  const next: ControlEdge = {
    id: edgeIdFor(input.sourceId, port, input.targetId, definition.edges),
    source: { nodeId: input.sourceId, port },
    target: { nodeId: input.targetId, port: input.targetPort ?? "in" },
  };
  if (definition.edges.some((edge) => sameRoute(edge, next))) {
    return definition;
  }
  if (definition.edges.some((edge) => edge.target.nodeId === next.target.nodeId)) {
    return definition;
  }
  return { ...definition, edges: [...definition.edges, next] };
};

const preferInbound = (left: ControlEdge, right: ControlEdge): ControlEdge =>
  right.source.port === "true" && left.source.port !== "true" ? right : left;

export const repairEdges = (definition: WorkflowDefinition): WorkflowDefinition => {
  const unique: ControlEdge[] = [];
  for (const edge of definition.edges) {
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
    const current = inbound.get(edge.target.nodeId);
    inbound.set(edge.target.nodeId, current ? preferInbound(current, edge) : edge);
  }
  return { ...definition, edges: [...inbound.values()] };
};
