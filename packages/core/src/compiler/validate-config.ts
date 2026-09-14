/** 노드 config 스키마와 제어 포트 존재 여부를 검사한다. */
import { diagnostic } from "../contracts/diagnostic.js";
import { validateJsonSchema } from "../json/schema.js";
import { ERROR_PORT } from "../nodes/reserved.js";
import type { CompilerContext, ResolvedNode } from "./types.js";
import { pushDiagnostic } from "./types.js";
import type { WorkflowDefinition } from "../contracts/workflow.js";

export const validateConfigs = (
  resolved: Readonly<Record<string, ResolvedNode>>,
  context: CompilerContext,
): void => {
  for (const node of Object.values(resolved)) {
    const issues = validateJsonSchema(node.spec.configSchema, node.instance.config);
    for (const issue of issues) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_NODE_CONFIG", issue.message, {
          nodeId: node.instance.id,
          path: `/config${issue.path}`,
        }),
      );
    }
  }
};

export const validateControlPorts = (
  definition: WorkflowDefinition,
  resolved: Readonly<Record<string, ResolvedNode>>,
  context: CompilerContext,
): void => {
  for (const edge of definition.edges) {
    const source = resolved[edge.source.nodeId];
    const target = resolved[edge.target.nodeId];
    if (source === undefined) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_CONTROL_PORT", `source node ${edge.source.nodeId} does not exist`, {
          edgeId: edge.id,
        }),
      );
    } else if (!source.controlOutputs.includes(edge.source.port)) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_CONTROL_PORT", `unknown source port ${edge.source.port}`, {
          edgeId: edge.id,
          nodeId: edge.source.nodeId,
          path: `/edges/${edge.id}/source/port`,
        }),
      );
    }
    if (target === undefined) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_CONTROL_PORT", `target node ${edge.target.nodeId} does not exist`, {
          edgeId: edge.id,
        }),
      );
    } else if (!target.controlInputs.includes(edge.target.port) && edge.target.port !== ERROR_PORT) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_CONTROL_PORT", `unknown target port ${edge.target.port}`, {
          edgeId: edge.id,
          nodeId: edge.target.nodeId,
          path: `/edges/${edge.id}/target/port`,
        }),
      );
    }
  }
};
