/**
 * registry에서 type+version을 찾고 인스턴스 포트를 확정한다.
 * error 제어 포트와 error 데이터 출력은 core가 예약한다.
 */
import { diagnostic } from "../contracts/diagnostic.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import type { WorkflowDefinition } from "../contracts/workflow.js";
import { ERROR_OUTPUT, ERROR_PORT } from "../nodes/reserved.js";
import { readInputNames } from "./read-input-names.js";
import type { CompilerContext, ResolvedNode } from "./types.js";
import { pushDiagnostic } from "./types.js";

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export const resolveNodes = (
  definition: WorkflowDefinition,
  registry: NodeRegistry,
  context: CompilerContext,
): Readonly<Record<string, ResolvedNode>> => {
  const resolved: Record<string, ResolvedNode> = {};
  for (const instance of definition.nodes) {
    const registered = registry.get(instance.type, instance.version);
    if (registered === undefined) {
      pushDiagnostic(
        context,
        diagnostic(
          "UNKNOWN_NODE_TYPE",
          `unknown node type ${instance.type}@${instance.version}`,
          { nodeId: instance.id },
        ),
      );
      continue;
    }
    const spec = registered.spec;
    const join = spec.control.join;
    const dynamicInputs = join === undefined ? undefined : readInputNames(instance.config);
    if (join !== undefined && dynamicInputs === undefined) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_NODE_CONFIG", "join node requires unique config.inputNames", {
          nodeId: instance.id,
          path: "/config/inputNames",
        }),
      );
      continue;
    }
    const controlInputs = dynamicInputs ?? spec.control.inputs;
    const controlOutputs = unique([...spec.control.outputs, ERROR_PORT]);
    if (spec.control.outputs.includes(ERROR_PORT) || spec.control.inputs.includes(ERROR_PORT)) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_CONTROL_PORT", "error port is reserved by core", { nodeId: instance.id }),
      );
    }
    const declaredOutputs = Object.keys(
      spec.outputSchema.properties !== null &&
        typeof spec.outputSchema.properties === "object" &&
        !Array.isArray(spec.outputSchema.properties)
        ? spec.outputSchema.properties
        : {},
    );
    if (declaredOutputs.includes(ERROR_OUTPUT)) {
      pushDiagnostic(
        context,
        diagnostic("INVALID_NODE_CONFIG", "error output is reserved by core", { nodeId: instance.id }),
      );
    }
    resolved[instance.id] = {
      instance,
      spec,
      controlInputs,
      controlOutputs,
      dataOutputs: unique([...declaredOutputs, ERROR_OUTPUT]),
      ...(join === undefined ? {} : { join }),
    };
  }
  return resolved;
};
