/**
 * compile·command·snapshot 실패를 편집기가 강조할 수 있게 구조화한다.
 * 예외를 던지지 않고 이 목록을 반환하는 것이 기본이다.
 */
export const DIAGNOSTIC_CODES = [
  "INVALID_WORKFLOW",
  "DUPLICATE_ID",
  "UNKNOWN_NODE_TYPE",
  "INVALID_NODE_CONFIG",
  "INVALID_CONTROL_PORT",
  "CYCLE_DETECTED",
  "UNREACHABLE_NODE",
  "INVALID_JOIN",
  "UNKNOWN_OUTPUT_REFERENCE",
  "UNAVAILABLE_REQUIRED_REFERENCE",
  "INPUT_SCHEMA_MISMATCH",
  "OUTPUT_SCHEMA_MISMATCH",
  "INVALID_COMMAND",
  "INVALID_SNAPSHOT",
  "INVALID_JSON",
] as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
  /** 설정·바인딩 JSON Pointer. 편집기가 필드를 강조할 때 쓴다. */
  readonly path?: string;
}

export const diagnostic = (
  code: DiagnosticCode,
  message: string,
  extra?: Pick<Diagnostic, "nodeId" | "edgeId" | "path">,
): Diagnostic => ({
  code,
  message,
  ...extra,
});
