/**
 * 모든 노드에 core가 붙이는 예약 이름.
 * 사용자 정상 출력이 error를 덮어쓸 수 없다.
 */
export const ERROR_PORT = "error";
export const ERROR_OUTPUT = "error";
export const SUCCESS_PORT = "success";
export const IN_PORT = "in";

export const reservedErrorSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: true,
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    details: { type: "object" },
  },
} as const;
