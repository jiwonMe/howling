/**
 * createEngine facade와 전이 결과.
 * 잘못된 command는 원래 상태를 그대로 두고 진단을 반환한다.
 */
import type { EngineCommand } from "./command.js";
import type { CompileResult, CompiledWorkflow } from "./compiled.js";
import type { Diagnostic } from "./diagnostic.js";
import type { EffectRequest } from "./effect.js";
import type { ExecutionEvent } from "./event.js";
import type { JsonValue } from "./json.js";
import type {
  ExecutionSnapshot,
  ExecutionState,
  RunMode,
} from "./state.js";
import type { WorkflowDefinition } from "./workflow.js";

/** 이번 전이에서 새로 생긴 항목만 담는다. 입력 상태는 변경하지 않는다. */
export interface Transition {
  readonly state: ExecutionState;
  readonly events: readonly ExecutionEvent[];
  readonly effects: readonly EffectRequest[];
}

export type TransitionResult =
  | { readonly ok: true; readonly transition: Transition }
  | {
      readonly ok: false;
      readonly state: ExecutionState;
      readonly diagnostics: readonly Diagnostic[];
    };

export interface StartRunOptions {
  readonly runId: string;
  readonly mode: RunMode;
  readonly logicalTime: number;
  readonly initialState?: Readonly<Record<string, JsonValue>>;
}

export type DriverRunStatus = "needs-input" | "paused" | "terminal";

export interface DriverRunResult {
  readonly status: DriverRunStatus;
  readonly state: ExecutionState;
  readonly events: readonly ExecutionEvent[];
  readonly effects: readonly EffectRequest[];
  readonly waitingReasons?: readonly string[];
}

/**
 * 자동 실행이 다음에 반영할 command를 고른다.
 * Kernel 로직을 다시 구현하지 말고 step·applyCommand만 반복한다.
 */
export interface EngineDriver {
  readonly nextCommands: (
    plan: CompiledWorkflow,
    state: ExecutionState,
    effects: readonly EffectRequest[],
  ) => readonly EngineCommand[];
}

export interface HowlingEngine {
  readonly compile: (definition: WorkflowDefinition) => CompileResult;
  readonly startRun: (
    plan: CompiledWorkflow,
    input: JsonValue,
    options: StartRunOptions,
  ) => TransitionResult;
  /** 준비된 노드 하나를 완료·실패·대기까지 진행한다. 하류는 자동 시작하지 않는다. */
  readonly step: (
    plan: CompiledWorkflow,
    state: ExecutionState,
  ) => TransitionResult;
  readonly applyCommand: (
    plan: CompiledWorkflow,
    state: ExecutionState,
    command: EngineCommand,
  ) => TransitionResult;
  readonly run: (
    plan: CompiledWorkflow,
    state: ExecutionState,
    driver: EngineDriver,
  ) => DriverRunResult;
  readonly snapshot: (state: ExecutionState) => ExecutionSnapshot;
  /** pending effect를 새 intent처럼 다시 발행하지 않는다. */
  readonly restore: (
    plan: CompiledWorkflow,
    snapshot: ExecutionSnapshot,
  ) => TransitionResult;
}
