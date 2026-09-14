/**
 * 노드 선언(NodeSpec)과 신뢰된 실행 코드(NodeImplementation)의 계약.
 * UI 색상·좌표·컴포넌트는 spec에 넣지 않는다.
 */
import type { CoreError } from "./error.js";
import type { EffectIntent, SettledEffectResponse } from "./effect.js";
import type { JsonObject, JsonValue } from "./json.js";

export interface NodeControlSpec {
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  /** ALL·ANY만 지정한다. 일반 노드는 제어 입력이 하나다. */
  readonly join?: "all" | "any";
}

export interface NodeSpec {
  readonly type: string;
  readonly version: number;
  readonly configSchema: JsonObject;
  readonly inputSchema: JsonObject;
  readonly outputSchema: JsonObject;
  readonly stateSchema?: JsonObject;
  readonly control: NodeControlSpec;
}

/** scheduler가 확정한 합류 정보. 일반 노드에는 전달하지 않는다. */
export type JoinContext =
  | { readonly kind: "all"; readonly activeInputs: readonly string[] }
  | { readonly kind: "any"; readonly selectedInput: string };

export interface NodeContext {
  readonly runId: string;
  readonly nodeId: string;
  readonly mode: "live" | "dryRun";
  /** 주입된 논리 시간. Date.now()를 읽지 않는다. */
  readonly logicalTime: number;
  readonly runInput: JsonValue;
  readonly inputs: Readonly<JsonObject>;
  readonly config: Readonly<JsonObject>;
  /** 실행 사이에 이어받는 분석 상태. 없음과 null을 구분한다. */
  readonly previousState?: JsonValue;
  readonly join?: JoinContext;
}

export type NodeOutcome =
  | {
      readonly kind: "complete";
      readonly outputs: JsonObject;
      readonly nextState?: JsonValue;
      /** 여기 없는 정상 출력 포트는 skipped로 해소한다. */
      readonly activate: readonly string[];
    }
  | { readonly kind: "fail"; readonly error: CoreError }
  | {
      readonly kind: "wait";
      readonly effect: EffectIntent;
      /** 재개에 필요한 일시 JSON. 분석 상태와 구분한다. */
      readonly continuation: JsonValue;
    };

export interface NodeImplementation {
  readonly start: (context: NodeContext) => NodeOutcome;
  /** wait을 반환하려면 반드시 있어야 한다. 없으면 effect 발행 전 실패다. */
  readonly resume?: (
    context: NodeContext,
    continuation: JsonValue,
    response: SettledEffectResponse,
  ) => NodeOutcome;
}

export interface RegisteredNode {
  readonly spec: NodeSpec;
  readonly implementation: NodeImplementation;
}
