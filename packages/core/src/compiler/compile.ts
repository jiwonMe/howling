/**
 * compile 파이프라인.
 * 구조 → 인스턴스 → 중복 ID → registry → 설정/포트 → DAG → 합류 → 참조 가용성 → 계획.
 * 하나라도 진단이 있으면 계획을 만들지 않는다.
 */
import type { CompileResult } from "../contracts/compiled.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import { computeAvailability } from "./guaranteed.js";
import { buildPlan } from "./build-plan.js";
import type { CompilerContext } from "./types.js";
import { resolveNodes } from "./resolve-nodes.js";
import { validateConfigs, validateControlPorts } from "./validate-config.js";
import { validateGraph } from "./validate-graph.js";
import { validateJoin } from "./validate-join.js";
import { validateReferences } from "./validate-references.js";
import { validateInstances } from "./validate-instances.js";
import { collectDuplicateIds, validateStructure } from "./validate-structure.js";

export const compileWorkflow = (
  definition: unknown,
  registry: NodeRegistry,
): CompileResult => {
  const structured = validateStructure(definition);
  if (!structured.ok) {
    return structured;
  }
  const instanceDiagnostics = validateInstances(structured.definition);
  if (instanceDiagnostics.length > 0) {
    return { ok: false, diagnostics: instanceDiagnostics };
  }
  const duplicates = collectDuplicateIds(structured.definition);
  if (duplicates.length > 0) {
    return { ok: false, diagnostics: duplicates };
  }
  const context: CompilerContext = { diagnostics: [] };
  const resolved = resolveNodes(structured.definition, registry, context);
  validateConfigs(resolved, context);
  validateControlPorts(structured.definition, resolved, context);
  const topoRank = validateGraph(structured.definition, resolved, context);
  validateJoin(structured.definition, resolved, context);
  const availability = computeAvailability(structured.definition, resolved, topoRank);
  validateReferences(structured.definition, resolved, availability, context);
  if (context.diagnostics.length > 0) {
    return { ok: false, diagnostics: context.diagnostics };
  }
  return {
    ok: true,
    plan: buildPlan(structured.definition, resolved, topoRank, availability),
  };
};
