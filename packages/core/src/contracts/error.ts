/**
 * 노드 실패와 라우팅된 오류 출력에 쓰는 구조화 오류.
 * 예상 가능한 사용자 오류는 예외 대신 이 값으로 남긴다.
 */
import type { JsonObject } from "./json.js";

export interface CoreError {
  readonly code: string;
  readonly message: string;
  readonly details?: JsonObject;
}

/** exactOptionalPropertyTypes 때문에 details는 있을 때만 넣는다. */
export const coreError = (
  code: string,
  message: string,
  details?: JsonObject,
): CoreError =>
  details === undefined
    ? { code, message }
    : { code, message, details };
