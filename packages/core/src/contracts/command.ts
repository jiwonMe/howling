/**
 * Host가 kernel에 주입하는 외부 명령.
 * commandId가 같으면 동일 payload는 no-op, 다른 payload는 거부한다.
 */
import type { EffectResponse } from "./effect.js";

export interface EffectDispatchStartedCommand {
  readonly type: "effect.dispatchStarted";
  readonly commandId: string;
  readonly effectId: string;
}

export interface EffectResolvedCommand {
  readonly type: "effect.resolved";
  readonly commandId: string;
  readonly effectId: string;
  readonly response: EffectResponse;
}

/** 논리 시간을 앞으로만 이동한다. 시간만 바꾼다고 하류를 실행하지 않는다. */
export interface ClockAdvancedCommand {
  readonly type: "clock.advanced";
  readonly commandId: string;
  readonly logicalTime: number;
}

export interface RunPauseCommand {
  readonly type: "run.pause";
  readonly commandId: string;
}

export interface RunResumeCommand {
  readonly type: "run.resume";
  readonly commandId: string;
}

export interface RunCancelCommand {
  readonly type: "run.cancel";
  readonly commandId: string;
}

export type EngineCommand =
  | EffectDispatchStartedCommand
  | EffectResolvedCommand
  | ClockAdvancedCommand
  | RunPauseCommand
  | RunResumeCommand
  | RunCancelCommand;
