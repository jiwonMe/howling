/**
 * 한 run의 JSON 직렬화 가능 상태.
 * Promise나 가변 참조를 넣지 않는다. 전이는 새 객체를 반환한다.
 */
import type { EffectRecord } from "./effect.js";
import type { JsonObject, JsonValue } from "./json.js";
import type { InputBinding } from "./workflow.js";

/** 실행 도중 live와 dryRun을 바꾸지 않는다. */
export type RunMode = "live" | "dryRun";

export type RunStatus =
  | "running"
  | "paused"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export type NodeRuntimeStatus =
  | "idle"
  | "ready"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "skipped";

/**
 * pending: 아직 활성/종료가 확정되지 않음.
 * taken: 소비 노드를 진행할 수 있음.
 * skipped: 선택되지 않았거나 상위가 비활성.
 * failed: 처리되지 않은 상위 오류.
 */
export type EdgeStatus = "pending" | "taken" | "skipped" | "failed";

export interface NodeRuntimeState {
  readonly status: NodeRuntimeStatus;
  readonly executionId: string;
  readonly effectIndex: number;
  readonly error?: { readonly code: string; readonly message: string };
  /** 오류 포트로 넘긴 실패. run 성공 판정에서 제외한다. */
  readonly routedError?: boolean;
}

export interface ExecutionState {
  readonly schemaVersion: 1;
  readonly snapshotVersion: 1;
  readonly runId: string;
  readonly workflowId: string;
  readonly revision: string;
  readonly workflowFingerprint: string;
  readonly nodeVersions: Readonly<Record<string, number>>;
  readonly mode: RunMode;
  readonly status: RunStatus;
  readonly logicalTime: number;
  readonly runInput: JsonValue;
  readonly nodes: Readonly<Record<string, NodeRuntimeState>>;
  /** 성공한 노드만 게시한다. 실패 노드의 정상 출력은 부분 노출하지 않는다. */
  readonly outputs: Readonly<Record<string, JsonObject>>;
  /** 시작 시 한 번 해석한 입력. 재개 때도 같은 값을 쓴다. */
  readonly resolvedInputs: Readonly<Record<string, JsonObject>>;
  readonly continuations: Readonly<Record<string, JsonValue>>;
  /** 성공 노드만 반영한 제안 분석 상태. 실제 영속화는 Host가 한다. */
  readonly proposedState: Readonly<Record<string, JsonValue>>;
  readonly initialState: Readonly<Record<string, JsonValue>>;
  readonly inputBindings: Readonly<
    Record<string, Readonly<Record<string, InputBinding>>>
  >;
  readonly edges: Readonly<Record<string, EdgeStatus>>;
  /** 위상 순위 + nodeId로 정렬. 화면 좌표와 무관하다. */
  readonly readyQueue: readonly string[];
  readonly effects: Readonly<Record<string, EffectRecord>>;
  readonly appliedCommandIds: readonly string[];
  readonly commandDigests: Readonly<Record<string, string>>;
  readonly lastEventSeq: number;
  readonly paused: boolean;
  readonly cancelled: boolean;
  /** ANY 노드별 확정된 승자 입력 이름. 늦은 완료가 바꾸지 않는다. */
  readonly anyWinners: Readonly<Record<string, string>>;
}

/** 과거 이벤트 전체를 쌓지 않는다. 현재 상태와 lastEventSeq만 담는다. */
export interface ExecutionSnapshot {
  readonly snapshotVersion: 1;
  readonly state: ExecutionState;
}

export type CommandRecord = {
  readonly commandId: string;
  readonly digest: string;
};
