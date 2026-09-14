/** compile 단계가 공유하는 해석된 노드와 진단 수집기. */
import type { Diagnostic } from "../contracts/diagnostic.js";
import type { NodeSpec } from "../contracts/node.js";
import type { NodeInstance } from "../contracts/workflow.js";

export interface ResolvedNode {
  readonly instance: NodeInstance;
  readonly spec: NodeSpec;
  readonly controlInputs: readonly string[];
  readonly controlOutputs: readonly string[];
  readonly dataOutputs: readonly string[];
  readonly join?: "all" | "any";
}

export interface CompilerContext {
  readonly diagnostics: Diagnostic[];
}

export const pushDiagnostic = (
  context: CompilerContext,
  diagnosticValue: Diagnostic,
): void => {
  context.diagnostics.push(diagnosticValue);
};
