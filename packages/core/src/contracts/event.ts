/**
 * 관측용 실행 이벤트.
 * Kernel은 콜백을 실행하지 않고 값만 반환한다. 로그 오류가 실행을 바꾸면 안 된다.
 */
import type { CoreError } from "./error.js";
import type { EffectIntent, EffectResponse } from "./effect.js";
import type { InputBinding } from "./workflow.js";
import type { JsonObject, JsonValue } from "./json.js";
import type { EdgeStatus, NodeRuntimeStatus, RunStatus } from "./state.js";

export type ExecutionEventType =
  | "run.started"
  | "run.waiting"
  | "run.paused"
  | "run.resumed"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "node.ready"
  | "node.started"
  | "node.waiting"
  | "node.completed"
  | "node.failed"
  | "node.skipped"
  | "edge.taken"
  | "edge.skipped"
  | "edge.failed"
  | "effect.requested"
  | "effect.dispatchStarted"
  | "effect.resolved"
  | "effect.unknown"
  | "effect.lateResult"
  | "node.stateUpdated";

export interface ExecutionEventBase {
  readonly runId: string;
  /** run 안에서 단조 증가. snapshot에는 마지막 순번만 남긴다. */
  readonly sequence: number;
  readonly logicalTime: number;
  readonly type: ExecutionEventType;
}

export interface RunEvent extends ExecutionEventBase {
  readonly type:
    | "run.started"
    | "run.waiting"
    | "run.paused"
    | "run.resumed"
    | "run.completed"
    | "run.failed"
    | "run.cancelled";
  readonly status?: RunStatus;
}

export interface NodeEvent extends ExecutionEventBase {
  readonly type:
    | "node.ready"
    | "node.started"
    | "node.waiting"
    | "node.completed"
    | "node.failed"
    | "node.skipped";
  readonly nodeId: string;
  readonly nodeExecutionId: string;
  readonly status?: NodeRuntimeStatus;
  readonly inputs?: JsonObject;
  readonly inputBindings?: Readonly<Record<string, InputBinding>>;
  readonly outputs?: JsonObject;
  readonly error?: CoreError;
  /** 조건 노드의 비교값·연산·선택 포트 등. */
  readonly decision?: JsonObject;
}

export interface EdgeEvent extends ExecutionEventBase {
  readonly type: "edge.taken" | "edge.skipped" | "edge.failed";
  readonly edgeId: string;
  readonly status: EdgeStatus;
}

export interface EffectEvent extends ExecutionEventBase {
  readonly type:
    | "effect.requested"
    | "effect.dispatchStarted"
    | "effect.resolved"
    | "effect.unknown"
    | "effect.lateResult";
  readonly effectId: string;
  readonly nodeId: string;
  readonly intent?: EffectIntent;
  readonly response?: EffectResponse;
}

export interface StateUpdatedEvent extends ExecutionEventBase {
  readonly type: "node.stateUpdated";
  readonly nodeId: string;
  readonly nextState: JsonValue;
}

export type ExecutionEvent =
  | RunEvent
  | NodeEvent
  | EdgeEvent
  | EffectEvent
  | StateUpdatedEvent;
