/**
 * 플로 목록·편집기·실행·token 응답.
 */
export interface TokenRow {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly string[];
  readonly flowId: string | null;
  readonly revokedAt: string | null;
}

export interface FlowListItem {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly revision_id: string | null;
  readonly deploy_status: string | null;
}

export interface FlowDetail {
  readonly flowId: string;
  readonly name: string;
  readonly draft: {
    readonly version: number;
    readonly definition: unknown;
    readonly triggers: unknown;
    readonly connections: unknown;
    readonly executionPolicy?: { readonly mode: "live" | "dry-run"; readonly captureRaw: boolean };
  };
  readonly editor: {
    readonly version: number;
    readonly positions: Record<string, { x: number; y: number }>;
    readonly viewport: { x: number; y: number; zoom: number };
  };
  readonly deployment: {
    readonly id: string;
    readonly revisionId: string;
    readonly status: string;
    readonly generation: number;
  } | null;
  readonly revisions?: readonly { readonly id: string; readonly created_at: string }[];
}

export interface RunRow {
  readonly runId: string;
  readonly flowId: string;
  readonly revisionId: string;
  readonly status: string;
  readonly lastSeq: number;
  readonly trigger: unknown;
  readonly events: readonly { sequence: number; type: string; nodeId?: string }[];
  readonly runMode?: string;
}
