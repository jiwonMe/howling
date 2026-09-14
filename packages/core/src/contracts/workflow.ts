/**
 * 사용자가 저장·공유하는 플로 정의.
 * 캔버스 좌표·색상·선택 상태는 넣지 않는다. 편집기가 따로 보관한다.
 */
import type { JsonObject, JsonPointer, JsonValue } from "./json.js";

/**
 * 노드 입력 하나의 출처.
 * 문자열 템플릿이나 임의 JS 표현식은 허용하지 않는다.
 */
export type InputBinding =
  /** 고정 값. */
  | { readonly kind: "literal"; readonly value: JsonValue }
  /** 이번 run 입력. path가 없으면 default만 쓸 수 있다. */
  | {
      readonly kind: "input";
      readonly path: JsonPointer;
      /** 경로가 없을 때만 사용. 값이 null이어도 default를 적용하지 않는다. */
      readonly default?: JsonValue;
    }
  /**
   * 다른 노드의 게시된 출력.
   * 제어 연결을 암묵적으로 추가하지 않는다. 가용성은 compiler가 검사한다.
   */
  | {
      readonly kind: "output";
      readonly nodeId: string;
      readonly output: string;
      readonly path?: JsonPointer;
      readonly default?: JsonValue;
    };

export interface NodeInstance {
  readonly id: string;
  readonly type: string;
  /** type과 함께 registry에서 구현을 찾는다. */
  readonly version: number;
  readonly config: JsonObject;
  readonly inputs: Readonly<Record<string, InputBinding>>;
}

/** 제어 포트 끝점. 데이터 참조와 별개다. */
export interface ControlEndpoint {
  readonly nodeId: string;
  readonly port: string;
}

/** 실행 순서를 결정하는 연결. 값이 흐르는 선이 아니다. */
export interface ControlEdge {
  readonly id: string;
  readonly source: ControlEndpoint;
  readonly target: ControlEndpoint;
}

export interface WorkflowDefinition {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly revision: string;
  readonly entryNodeId: string;
  readonly nodes: readonly NodeInstance[];
  readonly edges: readonly ControlEdge[];
}
