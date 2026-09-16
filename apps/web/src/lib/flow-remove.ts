/**
 * 노드·선 삭제. 지운 노드를 가리키는 바인딩은 함께 걷어낸다.
 */
import type { WorkflowDefinition } from "@howling/core";

export const removeEdges = (
  definition: WorkflowDefinition,
  edgeIds: readonly string[],
): WorkflowDefinition => {
  const gone = new Set(edgeIds);
  return { ...definition, edges: definition.edges.filter((edge) => !gone.has(edge.id)) };
};

export const removeNodes = (
  definition: WorkflowDefinition,
  nodeIds: readonly string[],
): WorkflowDefinition => {
  const gone = new Set(nodeIds);
  const nodes = definition.nodes
    .filter((node) => !gone.has(node.id))
    .map((node) => ({
      ...node,
      inputs: Object.fromEntries(
        Object.entries(node.inputs).filter(
          ([, binding]) => binding.kind !== "output" || !gone.has(binding.nodeId),
        ),
      ),
    }));
  const edges = definition.edges.filter(
    (edge) => !gone.has(edge.source.nodeId) && !gone.has(edge.target.nodeId),
  );
  const entryNodeId = gone.has(definition.entryNodeId)
    ? (nodes.find((node) => node.type === "core.input")?.id ?? nodes[0]?.id ?? "input")
    : definition.entryNodeId;
  return { ...definition, entryNodeId, nodes, edges };
};
