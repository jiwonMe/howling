/**
 * Core 정의를 감싸는 제품 모델.
 * WorkflowDefinition은 core에서 import하고 복제하지 않는다.
 */
import type { WorkflowDefinition } from "@howling/core";

export type TriggerKind =
  | "ha.state_changed"
  | "device.changed"
  | "sun"
  | "schedule"
  | "manual"
  | "timer";

export interface TriggerBinding {
  readonly id: string;
  readonly kind: TriggerKind;
  readonly connectionId: string | null;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface ConnectionBinding {
  readonly id: string;
  readonly kind: "ha" | "mcp";
  readonly connectionId: string;
}

export interface ExecutionPolicy {
  readonly mode: "live" | "dry-run";
  readonly captureRaw: boolean;
}

export interface ProductFlowDraft {
  readonly id: string;
  readonly siteId: string;
  readonly version: number;
  readonly definition: WorkflowDefinition;
  readonly triggers: readonly TriggerBinding[];
  readonly connections: readonly ConnectionBinding[];
  readonly executionPolicy: ExecutionPolicy;
}

export interface EditorGroup {
  readonly id: string;
  readonly title: string;
  readonly nodeIds: readonly string[];
}

export interface EditorDocument {
  readonly flowId: string;
  readonly version: number;
  readonly positions: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  readonly groups: readonly EditorGroup[];
  readonly viewport: {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
  };
}

export interface RuntimeRequirements {
  readonly protocolVersion: 1;
  readonly nodeCatalogVersion: string;
  readonly connectors: readonly string[];
}

export interface RevisionArtifact {
  readonly schemaVersion: 1;
  readonly siteId: string;
  readonly flowId: string;
  readonly revisionId: string;
  readonly definition: WorkflowDefinition;
  readonly triggers: readonly TriggerBinding[];
  readonly connections: readonly ConnectionBinding[];
  readonly requirements: RuntimeRequirements;
  readonly executionPolicy: ExecutionPolicy;
  readonly artifactDigest: string;
}
