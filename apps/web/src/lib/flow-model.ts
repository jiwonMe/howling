/**
 * 편집기용 정의·좌표 변환.
 */
import { officialCatalog, type CatalogNode } from "@howling/contracts";
import type { WorkflowDefinition } from "@howling/core";

type NodeInstance = WorkflowDefinition["nodes"][number];
type ControlEdge = WorkflowDefinition["edges"][number];

export const catalogOf = (type: string): CatalogNode | undefined =>
  officialCatalog.find((item) => item.type === type);

export const emptyDefinition = (flowId: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id: flowId,
  revision: "draft",
  entryNodeId: "input",
  nodes: [],
  edges: [],
});

export const nextNodeId = (type: string, nodes: readonly NodeInstance[]): string => {
  const base =
    type === "core.input"
      ? "input"
      : type === "analysis.rolling-mean"
        ? "mean"
        : type === "core.condition"
          ? "condition"
          : "effect";
  if (!nodes.some((node) => node.id === base)) {
    return base;
  }
  let index = 2;
  while (nodes.some((node) => node.id === `${base}-${String(index)}`)) {
    index += 1;
  }
  return `${base}-${String(index)}`;
};

export const defaultNode = (type: string, id: string): NodeInstance => {
  const catalog = catalogOf(type);
  const config =
    type === "core.effect"
      ? { adapter: "homeassistant", operation: "call_service" }
      : { ...(catalog?.defaultConfig ?? {}) };
  return {
    id,
    type,
    version: catalog?.version ?? 1,
    config: config as NodeInstance["config"],
    inputs: {},
  };
};

export const sourcePort = (type: string): string =>
  type === "core.condition" ? "true" : "success";

export const addNode = (
  definition: WorkflowDefinition,
  type: string,
): { definition: WorkflowDefinition; nodeId: string } => {
  const nodeId = nextNodeId(type, definition.nodes);
  const node = defaultNode(type, nodeId);
  const previous = definition.nodes.at(-1);
  const edges = previous
    ? [
        ...definition.edges,
        {
          id: `e-${previous.id}-${nodeId}`,
          source: { nodeId: previous.id, port: sourcePort(previous.type) },
          target: { nodeId, port: "in" },
        } satisfies ControlEdge,
      ]
    : definition.edges;
  return {
    nodeId,
    definition: {
      ...definition,
      entryNodeId: definition.nodes[0]?.id ?? nodeId,
      nodes: [...definition.nodes, node],
      edges,
    },
  };
};

export const replaceNode = (
  definition: WorkflowDefinition,
  nodeId: string,
  patch: Partial<NodeInstance>,
): WorkflowDefinition => ({
  ...definition,
  nodes: definition.nodes.map((node) =>
    node.id === nodeId ? { ...node, ...patch, id: node.id, type: node.type } : node,
  ),
});

export const defaultPosition = (
  index: number,
): { x: number; y: number } => ({ x: index * 220, y: 80 });
