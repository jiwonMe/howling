/**
 * 노드 context를 만들고 start를 호출한다.
 * 구현이 던진 예외는 노드 실패로 바꾼다. 입력·출력은 스키마로 검증한다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import { coreError } from "../contracts/error.js";
import type { JoinContext, NodeContext, NodeOutcome } from "../contracts/node.js";
import type { JsonObject } from "../contracts/json.js";
import type { ExecutionState } from "../contracts/state.js";
import { validateJsonSchema } from "../json/schema.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import { cloneJson } from "../json/clone.js";

export const buildNodeContext = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
  inputs: JsonObject,
): NodeContext | undefined => {
  const node = plan.nodes[nodeId];
  if (node === undefined) {
    return undefined;
  }
  const previous = state.initialState[nodeId] ?? state.proposedState[nodeId];
  const join = joinContext(plan, state, nodeId);
  return {
    runId: state.runId,
    nodeId,
    mode: state.mode,
    logicalTime: state.logicalTime,
    runInput: state.runInput,
    inputs,
    config: node.instance.config,
    ...(previous === undefined ? {} : { previousState: cloneJson(previous) }),
    ...(join === undefined ? {} : { join }),
  };
};

const joinContext = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): JoinContext | undefined => {
  const node = plan.nodes[nodeId];
  if (node?.join === "all") {
    const activeInputs = node.controlInputs.filter((port) =>
      (plan.incoming[nodeId]?.[port] ?? []).some((edgeId) => state.edges[edgeId] === "taken"),
    );
    return { kind: "all", activeInputs };
  }
  if (node?.join === "any") {
    const selected = state.anyWinners[nodeId];
    return selected === undefined ? undefined : { kind: "any", selectedInput: selected };
  }
  return undefined;
};

export const runNodeStart = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  context: NodeContext,
): NodeOutcome => {
  const node = plan.nodes[context.nodeId];
  if (node === undefined) {
    return { kind: "fail", error: coreError("UNKNOWN_NODE_TYPE", "node is missing from plan") };
  }
  const registered = registry.get(node.instance.type, node.instance.version);
  if (registered === undefined) {
    return { kind: "fail", error: coreError("UNKNOWN_NODE_TYPE", "node implementation is missing") };
  }
  const inputIssues = validateJsonSchema(node.spec.inputSchema, context.inputs);
  if (inputIssues.length > 0) {
    return {
      kind: "fail",
      error: coreError("INPUT_SCHEMA_MISMATCH", inputIssues[0]?.message ?? "input schema mismatch"),
    };
  }
  try {
    return registered.implementation.start(context);
  } catch (error) {
    return {
      kind: "fail",
      error: coreError("NODE_EXCEPTION", error instanceof Error ? error.message : "node failed"),
    };
  }
};

export const validateOutputs = (
  plan: CompiledWorkflow,
  nodeId: string,
  outputs: JsonObject,
): NodeOutcome | undefined => {
  const node = plan.nodes[nodeId];
  if (node === undefined) {
    return { kind: "fail", error: coreError("UNKNOWN_NODE_TYPE", "node is missing from plan") };
  }
  const issues = validateJsonSchema(node.spec.outputSchema, outputs);
  if (issues.length > 0) {
    return {
      kind: "fail",
      error: coreError("OUTPUT_SCHEMA_MISMATCH", issues[0]?.message ?? "output schema mismatch"),
    };
  }
  return undefined;
};
