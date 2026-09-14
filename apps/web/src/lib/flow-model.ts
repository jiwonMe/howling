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

const firstNodeId = (nodes: readonly NodeInstance[], type: string, fallback: string): string =>
  nodes.find((node) => node.type === type)?.id ?? fallback;

export const wiredInputs = (
  type: string,
  nodes: readonly NodeInstance[],
): NodeInstance["inputs"] => {
  if (type === "analysis.rolling-mean") {
    return {
      value: {
        kind: "output",
        nodeId: firstNodeId(nodes, "core.input", "input"),
        output: "value",
        path: "/power",
      },
    };
  }
  if (type === "core.condition") {
    return {
      left: {
        kind: "output",
        nodeId: firstNodeId(nodes, "analysis.rolling-mean", "mean"),
        output: "mean",
      },
    };
  }
  return {};
};

export const defaultNode = (type: string, id: string, nodes: readonly NodeInstance[] = []): NodeInstance => {
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
    inputs: wiredInputs(type, nodes),
  };
};

export const repairBindings = (definition: WorkflowDefinition): WorkflowDefinition => {
  const ids = new Set(definition.nodes.map((node) => node.id));
  return {
    ...definition,
    nodes: definition.nodes.map((node) => ({
      ...node,
      inputs: Object.fromEntries(
        Object.entries(node.inputs).map(([name, binding]) => {
          if (binding.kind !== "output" || ids.has(binding.nodeId)) {
            return [name, binding];
          }
          if (node.type === "analysis.rolling-mean" && name === "value") {
            return [
              name,
              {
                kind: "output" as const,
                nodeId: firstNodeId(definition.nodes, "core.input", "input"),
                output: "value",
                path: binding.path ?? "/power",
              },
            ];
          }
          if (node.type === "core.condition" && name === "left") {
            return [
              name,
              {
                kind: "output" as const,
                nodeId: firstNodeId(definition.nodes, "analysis.rolling-mean", "mean"),
                output: "mean",
              },
            ];
          }
          return [name, binding];
        }),
      ),
    })),
  };
};

export const sourcePort = (type: string): string =>
  type === "core.condition" ? "true" : "success";

export const addNode = (
  definition: WorkflowDefinition,
  type: string,
): { definition: WorkflowDefinition; nodeId: string } => {
  const nodeId = nextNodeId(type, definition.nodes);
  const node = defaultNode(type, nodeId, definition.nodes);
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
