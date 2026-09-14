/** 노드·엣지 필드의 최소 형태 검사. 타입 조회 전에 잘못된 JSON을 걸러낸다. */
import { diagnostic } from "../contracts/diagnostic.js";
import type { Diagnostic } from "../contracts/diagnostic.js";
import type { InputBinding, WorkflowDefinition } from "../contracts/workflow.js";

const isBinding = (value: unknown): value is InputBinding => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const binding = value as { kind?: unknown };
  return binding.kind === "literal" || binding.kind === "input" || binding.kind === "output";
};

export const validateInstances = (definition: WorkflowDefinition): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  for (const node of definition.nodes) {
    if (typeof node.id !== "string" || typeof node.type !== "string") {
      diagnostics.push(diagnostic("INVALID_WORKFLOW", "node id and type must be strings"));
      continue;
    }
    if (typeof node.version !== "number" || !Number.isInteger(node.version)) {
      diagnostics.push(
        diagnostic("INVALID_WORKFLOW", "node version must be an integer", { nodeId: node.id }),
      );
    }
    if (typeof node.config !== "object" || node.config === null || Array.isArray(node.config)) {
      diagnostics.push(
        diagnostic("INVALID_WORKFLOW", "node config must be an object", { nodeId: node.id }),
      );
    }
    if (typeof node.inputs !== "object" || node.inputs === null || Array.isArray(node.inputs)) {
      diagnostics.push(
        diagnostic("INVALID_WORKFLOW", "node inputs must be an object", { nodeId: node.id }),
      );
      continue;
    }
    for (const [name, binding] of Object.entries(node.inputs)) {
      if (!isBinding(binding)) {
        diagnostics.push(
          diagnostic("INVALID_WORKFLOW", `invalid input binding ${name}`, {
            nodeId: node.id,
            path: `/nodes/${node.id}/inputs/${name}`,
          }),
        );
      }
    }
  }
  for (const edge of definition.edges) {
    const valid =
      typeof edge.id === "string" &&
      typeof edge.source?.nodeId === "string" &&
      typeof edge.source.port === "string" &&
      typeof edge.target?.nodeId === "string" &&
      typeof edge.target.port === "string";
    if (!valid) {
      diagnostics.push(diagnostic("INVALID_WORKFLOW", "edge endpoints are invalid", { edgeId: edge.id }));
    }
  }
  return diagnostics;
};
