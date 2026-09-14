/** 인접 목록·고정 엣지 순서·fingerprint를 담은 실행 계획을 만든다. */
import type { CompiledNode, CompiledWorkflow } from "../contracts/compiled.js";
import type { ControlEdge, WorkflowDefinition } from "../contracts/workflow.js";
import { canonicalizeJson } from "../json/canonical.js";
import { fnv1a64 } from "../json/hash.js";
import type { Availability } from "./guaranteed.js";
import type { ResolvedNode } from "./types.js";

const indexEdges = (
  edges: readonly ControlEdge[],
  pick: (edge: ControlEdge) => { nodeId: string; port: string },
): Record<string, Record<string, string[]>> => {
  const result: Record<string, Record<string, string[]>> = {};
  const sorted = [...edges].sort((left, right) => left.id.localeCompare(right.id));
  for (const edge of sorted) {
    const endpoint = pick(edge);
    const ports = result[endpoint.nodeId] ?? {};
    const list = ports[endpoint.port] ?? [];
    list.push(edge.id);
    ports[endpoint.port] = list;
    result[endpoint.nodeId] = ports;
  }
  return result;
};

export const fingerprintDefinition = (
  definition: WorkflowDefinition,
  nodeVersions: Readonly<Record<string, number>>,
): string =>
  fnv1a64(
    canonicalizeJson({
      definition: definition as unknown as import("../contracts/json.js").JsonValue,
      nodeVersions: nodeVersions as unknown as import("../contracts/json.js").JsonValue,
    }),
  );

export const buildPlan = (
  definition: WorkflowDefinition,
  resolved: Readonly<Record<string, ResolvedNode>>,
  topoRank: Readonly<Record<string, number>>,
  availability: Availability,
): CompiledWorkflow => {
  const nodes: Record<string, CompiledNode> = {};
  const nodeVersions: Record<string, number> = {};
  for (const [nodeId, node] of Object.entries(resolved)) {
    nodes[nodeId] = {
      instance: node.instance,
      spec: node.spec,
      controlInputs: node.controlInputs,
      controlOutputs: node.controlOutputs,
      dataOutputs: node.dataOutputs,
      ...(node.join === undefined ? {} : { join: node.join }),
    };
    nodeVersions[nodeId] = node.spec.version;
  }
  const edgeMap: Record<string, ControlEdge> = {};
  for (const edge of definition.edges) {
    edgeMap[edge.id] = edge;
  }
  return {
    definition,
    fingerprint: fingerprintDefinition(definition, nodeVersions),
    entryNodeId: definition.entryNodeId,
    nodes,
    edges: edgeMap,
    outgoing: indexEdges(definition.edges, (edge) => edge.source),
    incoming: indexEdges(definition.edges, (edge) => edge.target),
    topoRank,
    nodeVersions,
    guaranteedSuccess: availability.success,
  };
};
