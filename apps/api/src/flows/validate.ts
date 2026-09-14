/**
 * 공식 catalog + core compile.
 */
import { createEngine, createOfficialRegistry, type WorkflowDefinition } from "@howling/core";

const engine = createEngine({ registry: createOfficialRegistry() });

export const compileDefinition = (definition: unknown) => {
  const compiled = engine.compile(definition as WorkflowDefinition);
  if (!compiled.ok) {
    return {
      ok: false as const,
      diagnostics: compiled.diagnostics.map((item) => ({
        code: item.code,
        message: item.message,
        nodeId: item.nodeId,
      })),
    };
  }
  return { ok: true as const, fingerprint: compiled.plan.fingerprint };
};
