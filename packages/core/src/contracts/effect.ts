/**
 * 외부 작업·타이머 요청과 응답.
 * effects 배열에 올랐다고 실제 I/O가 끝난 것은 아니다. Host가 전달한다.
 */
import type { CoreError } from "./error.js";
import type { JsonValue } from "./json.js";

export type EffectIntent =
  | {
      readonly kind: "external";
      /** Host와의 계약 이름. HA 서비스명을 Core가 해석하지 않는다. */
      readonly adapter: string;
      readonly operation: string;
      /** Secret을 넣지 않는다. 연결 정보는 Host가 adapter 참조로 해석한다. */
      readonly input: JsonValue;
    }
  | { readonly kind: "timer"; readonly dueAt: number };

export interface EffectRequest {
  readonly id: string;
  readonly runId: string;
  readonly nodeId: string;
  /** 같은 node execution 안에서 몇 번째 대기인지. 복원 시 재생성해도 같다. */
  readonly index: number;
  readonly intent: EffectIntent;
}

export type EffectResponseSource = "live" | "fixture" | "recorded" | "simulated";

export type EffectResponse = {
  readonly source: EffectResponseSource;
} & (
  | { readonly status: "succeeded"; readonly value: JsonValue }
  | { readonly status: "failed"; readonly error: CoreError }
  /** 성공·실패로 추정하지 않는다. resume을 호출하지 않는다. */
  | { readonly status: "unknown"; readonly reason: string }
);

export type SettledEffectResponse = Exclude<
  EffectResponse,
  { readonly status: "unknown" }
>;

export type EffectRecordStatus =
  | "requested"
  | "dispatchStarted"
  | "resolved"
  | "unknown";

/** snapshot에 남기는 실행 중 effect 상태. */
export interface EffectRecord {
  readonly id: string;
  readonly runId: string;
  readonly nodeId: string;
  readonly index: number;
  readonly intent: EffectIntent;
  readonly status: EffectRecordStatus;
  readonly response?: EffectResponse;
}
