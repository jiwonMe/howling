/**
 * 일반 노드는 제어 입력이 하나, ALL·ANY는 선언한 입력마다 엣지와 값 바인딩이 있어야 한다.
 * 여러 경로가 만나면 명시적 합류 노드를 강제한다.
 */
import { diagnostic } from "../contracts/diagnostic.js";
import type { WorkflowDefinition } from "../contracts/workflow.js";
import { ERROR_PORT } from "../nodes/reserved.js";
import type { CompilerContext, ResolvedNode } from "./types.js";
import { pushDiagnostic } from "./types.js";

export const validateJoin = (
  definition: WorkflowDefinition,
  resolved: Readonly<Record<string, ResolvedNode>>,
  context: CompilerContext,
): void => {
  const incoming = new Map<string, { port: string; edgeId: string }[]>();
  for (const edge of definition.edges) {
    if (edge.target.port === ERROR_PORT) {
      continue;
    }
    const list = incoming.get(edge.target.nodeId) ?? [];
    list.push({ port: edge.target.port, edgeId: edge.id });
    incoming.set(edge.target.nodeId, list);
  }
  for (const node of Object.values(resolved)) {
    const edges = incoming.get(node.instance.id) ?? [];
    if (node.join === undefined) {
      validateRegularIncoming(definition, node, edges, context);
      continue;
    }
    validateJoinIncoming(node, edges, context);
  }
};

const validateRegularIncoming = (
  definition: WorkflowDefinition,
  node: ResolvedNode,
  edges: readonly { port: string; edgeId: string }[],
  context: CompilerContext,
): void => {
  if (node.instance.id === definition.entryNodeId) {
    if (edges.length > 0 || node.controlInputs.length > 0) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_JOIN", "entry node cannot have control inputs", {
          nodeId: node.instance.id,
        }),
      );
    }
    return;
  }
  if (node.controlInputs.length !== 1) {
    pushDiagnostic(
      context,
      diagnostic("INVALID_JOIN", "regular node must declare exactly one control input", {
        nodeId: node.instance.id,
      }),
    );
  }
  if (edges.length !== 1) {
    pushDiagnostic(
      context,
      diagnostic("INVALID_JOIN", "regular node must have exactly one inbound control edge", {
        nodeId: node.instance.id,
      }),
    );
  }
};

const validateJoinIncoming = (
  node: ResolvedNode,
  edges: readonly { port: string; edgeId: string }[],
  context: CompilerContext,
): void => {
  const expected = new Set(node.controlInputs);
  const seen = new Set<string>();
  for (const edge of edges) {
    if (!expected.has(edge.port)) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_JOIN", `unexpected join input ${edge.port}`, {
          nodeId: node.instance.id,
          edgeId: edge.edgeId,
        }),
      );
      continue;
    }
    if (seen.has(edge.port)) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_JOIN", `join input ${edge.port} has multiple edges`, {
          nodeId: node.instance.id,
          edgeId: edge.edgeId,
        }),
      );
    }
    seen.add(edge.port);
  }
  for (const name of node.controlInputs) {
    if (!seen.has(name)) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_JOIN", `join input ${name} is not connected`, {
          nodeId: node.instance.id,
          path: `/nodes/${node.instance.id}/inputs/${name}`,
        }),
      );
    }
    const binding = node.instance.inputs[name];
    if (binding === undefined) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_JOIN", `join input ${name} is missing a value binding`, {
          nodeId: node.instance.id,
          path: `/nodes/${node.instance.id}/inputs/${name}`,
        }),
      );
    }
  }
};
