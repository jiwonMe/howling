/**
 * compile이 만든 실행 계획.
 * 인접 목록·합류 포트·참조 가용성·fingerprint를 미리 고정한다.
 */
import type { NodeSpec } from "./node.js";
import type { ControlEdge, NodeInstance, WorkflowDefinition } from "./workflow.js";

export interface CompiledNode {
  readonly instance: NodeInstance;
  readonly spec: NodeSpec;
  /** ALL·ANY는 config.inputNames로 확정된 인스턴스 포트다. */
  readonly controlInputs: readonly string[];
  readonly controlOutputs: readonly string[];
  readonly dataOutputs: readonly string[];
  readonly join?: "all" | "any";
}

export interface CompiledWorkflow {
  readonly definition: WorkflowDefinition;
  readonly fingerprint: string;
  readonly entryNodeId: string;
  readonly nodes: Readonly<Record<string, CompiledNode>>;
  readonly edges: Readonly<Record<string, ControlEdge>>;
  readonly outgoing: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  readonly incoming: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  readonly topoRank: Readonly<Record<string, number>>;
  readonly nodeVersions: Readonly<Record<string, number>>;
  /** 해당 노드가 시작할 때 성공이 보장되는 생산자 nodeId 목록. */
  readonly guaranteedSuccess: Readonly<Record<string, readonly string[]>>;
}

export type CompileResult =
  | { readonly ok: true; readonly plan: CompiledWorkflow }
  | {
      readonly ok: false;
      readonly diagnostics: readonly import("./diagnostic.js").Diagnostic[];
    };
