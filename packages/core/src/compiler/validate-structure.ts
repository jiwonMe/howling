/** schemaVersion·필수 필드·중복 ID·entry 존재 검사. */
import type { Diagnostic } from "../contracts/diagnostic.js";
import { diagnostic } from "../contracts/diagnostic.js";
import type { WorkflowDefinition } from "../contracts/workflow.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validateStructure = (
  definition: unknown,
): { ok: true; definition: WorkflowDefinition } | { ok: false; diagnostics: Diagnostic[] } => {
  if (!isRecord(definition)) {
    return {
      ok: false,
      diagnostics: [diagnostic("INVALID_WORKFLOW", "workflow definition must be an object")],
    };
  }
  const diagnostics: Diagnostic[] = [];
  if (definition.schemaVersion !== 1) {
    diagnostics.push(diagnostic("INVALID_WORKFLOW", "schemaVersion must be 1"));
  }
  if (typeof definition.id !== "string" || definition.id.length === 0) {
    diagnostics.push(diagnostic("INVALID_WORKFLOW", "id must be a non-empty string"));
  }
  if (typeof definition.revision !== "string" || definition.revision.length === 0) {
    diagnostics.push(diagnostic("INVALID_WORKFLOW", "revision must be a non-empty string"));
  }
  if (typeof definition.entryNodeId !== "string" || definition.entryNodeId.length === 0) {
    diagnostics.push(diagnostic("INVALID_WORKFLOW", "entryNodeId must be a non-empty string"));
  }
  if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) {
    diagnostics.push(diagnostic("INVALID_WORKFLOW", "nodes must be a non-empty array"));
  }
  if (!Array.isArray(definition.edges)) {
    diagnostics.push(diagnostic("INVALID_WORKFLOW", "edges must be an array"));
  }
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, definition: definition as unknown as WorkflowDefinition };
};

export const collectDuplicateIds = (definition: WorkflowDefinition): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  const nodeIds = new Set<string>();
  for (const node of definition.nodes) {
    if (nodeIds.has(node.id)) {
      diagnostics.push(diagnostic("DUPLICATE_ID", `duplicate node id ${node.id}`, { nodeId: node.id }));
    }
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of definition.edges) {
    if (edgeIds.has(edge.id)) {
      diagnostics.push(diagnostic("DUPLICATE_ID", `duplicate edge id ${edge.id}`, { edgeId: edge.id }));
    }
    edgeIds.add(edge.id);
  }
  if (!nodeIds.has(definition.entryNodeId)) {
    diagnostics.push(
      diagnostic("INVALID_WORKFLOW", `entry node ${definition.entryNodeId} does not exist`, {
        nodeId: definition.entryNodeId,
      }),
    );
  }
  return diagnostics;
};
