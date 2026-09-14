/**
 * 입력 바인딩을 한 번 해석한다.
 * ALL은 taken 입력만, ANY는 승자만 읽는다. 없는 경로는 default가 있을 때만 통과한다.
 */
import type { CompiledNode, CompiledWorkflow } from "../contracts/compiled.js";
import { diagnostic } from "../contracts/diagnostic.js";
import type { Diagnostic } from "../contracts/diagnostic.js";
import type { JsonObject, JsonValue } from "../contracts/json.js";
import type { ExecutionState } from "../contracts/state.js";
import type { InputBinding } from "../contracts/workflow.js";
import { cloneJson } from "../json/clone.js";
import { getByPointer } from "../json/pointer.js";

export type ResolvedInputsResult =
  | { readonly ok: true; readonly inputs: JsonObject }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

const lookupBinding = (
  binding: InputBinding,
  state: ExecutionState,
): { ok: true; value: JsonValue } | { ok: false; message: string } => {
  if (binding.kind === "literal") {
    return { ok: true, value: cloneJson(binding.value) };
  }
  if (binding.kind === "input") {
    const looked = getByPointer(state.runInput, binding.path);
    if (looked.found) {
      return { ok: true, value: cloneJson(looked.value) };
    }
    if (binding.default !== undefined) {
      return { ok: true, value: cloneJson(binding.default) };
    }
    return { ok: false, message: `run input path ${binding.path} is missing` };
  }
  const outputs = state.outputs[binding.nodeId];
  if (outputs === undefined || !Object.hasOwn(outputs, binding.output)) {
    if (binding.default !== undefined) {
      return { ok: true, value: cloneJson(binding.default) };
    }
    return { ok: false, message: `output ${binding.nodeId}.${binding.output} is missing` };
  }
  const root = outputs[binding.output];
  if (root === undefined) {
    return binding.default !== undefined
      ? { ok: true, value: cloneJson(binding.default) }
      : { ok: false, message: `output ${binding.nodeId}.${binding.output} is missing` };
  }
  const looked = getByPointer(root, binding.path ?? "");
  if (looked.found) {
    return { ok: true, value: cloneJson(looked.value) };
  }
  if (binding.default !== undefined) {
    return { ok: true, value: cloneJson(binding.default) };
  }
  return { ok: false, message: `output path ${binding.path ?? ""} is missing` };
};

export const resolveNodeInputs = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
  names: readonly string[],
): ResolvedInputsResult => {
  const node: CompiledNode | undefined = plan.nodes[nodeId];
  if (node === undefined) {
    return {
      ok: false,
      diagnostics: [diagnostic("UNKNOWN_NODE_TYPE", `node ${nodeId} is not in the plan`)],
    };
  }
  const inputs: { [key: string]: JsonValue } = {};
  const diagnostics: Diagnostic[] = [];
  for (const name of names) {
    const binding = node.instance.inputs[name];
    if (binding === undefined) {
      continue;
    }
    const looked = lookupBinding(binding, state);
    if (!looked.ok) {
      diagnostics.push(
        diagnostic("INPUT_SCHEMA_MISMATCH", looked.message, {
          nodeId,
          path: `/nodes/${nodeId}/inputs/${name}`,
        }),
      );
      continue;
    }
    inputs[name] = looked.value;
  }
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, inputs };
};

export const inputNamesForStart = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): readonly string[] => {
  const node = plan.nodes[nodeId];
  if (node === undefined) {
    return [];
  }
  if (node.join === "all") {
    return takenJoinInputs(plan, state, nodeId);
  }
  if (node.join === "any") {
    const winner = state.anyWinners[nodeId];
    return winner === undefined ? [] : [winner];
  }
  return Object.keys(node.instance.inputs);
};

const takenJoinInputs = (
  plan: CompiledWorkflow,
  state: ExecutionState,
  nodeId: string,
): string[] => {
  const node = plan.nodes[nodeId];
  if (node === undefined) {
    return [];
  }
  return node.controlInputs.filter((port) => {
    const edgeIds = plan.incoming[nodeId]?.[port] ?? [];
    return edgeIds.some((edgeId) => state.edges[edgeId] === "taken");
  });
};
