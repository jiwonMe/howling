/**
 * 출력 참조의 존재와 필수 가용성.
 * default가 있으면 가용성 검사를 건너뛴다. null은 default 사유가 아니다.
 */
import { diagnostic } from "../contracts/diagnostic.js";
import type { InputBinding } from "../contracts/workflow.js";
import type { WorkflowDefinition } from "../contracts/workflow.js";
import { splitPointer } from "../json/pointer.js";
import { ERROR_OUTPUT } from "../nodes/reserved.js";
import type { Availability } from "./guaranteed.js";
import { joinPortAvailability } from "./guaranteed.js";
import type { CompilerContext, ResolvedNode } from "./types.js";
import { pushDiagnostic } from "./types.js";

export const validateReferences = (
  definition: WorkflowDefinition,
  resolved: Readonly<Record<string, ResolvedNode>>,
  availability: Availability,
  context: CompilerContext,
): void => {
  for (const node of Object.values(resolved)) {
    for (const [name, binding] of Object.entries(node.instance.inputs)) {
      // 합류 입력 바인딩은 그 포트가 taken일 때만 읽히므로 해당 선행 경로 기준으로 본다.
      const scope =
        node.join !== undefined && node.controlInputs.includes(name)
          ? joinPortAvailability(definition, availability, node.instance.id, name)
          : {
              success: availability.success[node.instance.id] ?? [],
              errors: availability.errors[node.instance.id] ?? [],
            };
      validateBinding(node.instance.id, name, binding, resolved, scope, context);
    }
  }
};

const validateBinding = (
  nodeId: string,
  inputName: string,
  binding: InputBinding,
  resolved: Readonly<Record<string, ResolvedNode>>,
  scope: { success: readonly string[]; errors: readonly string[] },
  context: CompilerContext,
): void => {
  if (binding.kind === "literal") {
    return;
  }
  if (binding.kind === "input") {
    if (splitPointer(binding.path) === undefined) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_WORKFLOW", "input binding path must be a JSON Pointer", {
          nodeId,
          path: `/nodes/${nodeId}/inputs/${inputName}/path`,
        }),
      );
    }
    return;
  }
  if (binding.path !== undefined && splitPointer(binding.path) === undefined) {
    pushDiagnostic(
      context,
      diagnostic("INVALID_WORKFLOW", "output binding path must be a JSON Pointer", {
        nodeId,
        path: `/nodes/${nodeId}/inputs/${inputName}/path`,
      }),
    );
  }
  const producer = resolved[binding.nodeId];
  if (producer === undefined || !producer.dataOutputs.includes(binding.output)) {
    pushDiagnostic(
      context,
      diagnostic(
        "UNKNOWN_OUTPUT_REFERENCE",
        `unknown output ${binding.nodeId}.${binding.output}`,
        { nodeId, path: `/nodes/${nodeId}/inputs/${inputName}` },
      ),
    );
    return;
  }
  if (binding.default !== undefined) {
    return;
  }
  const available =
    binding.output === ERROR_OUTPUT
      ? scope.errors.includes(binding.nodeId)
      : scope.success.includes(binding.nodeId);
  if (!available) {
    pushDiagnostic(
      context,
      diagnostic(
        "UNAVAILABLE_REQUIRED_REFERENCE",
        `required output ${binding.nodeId}.${binding.output} is not guaranteed`,
        { nodeId, path: `/nodes/${nodeId}/inputs/${inputName}` },
      ),
    );
  }
};
