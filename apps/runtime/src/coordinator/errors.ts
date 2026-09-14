/**
 * Coordinator HTTP·테스트용 오류.
 */
export type HostErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "QUEUE_FULL"
  | "INVALID"
  | "FAILED";

export class HostError extends Error {
  readonly code: HostErrorCode;

  constructor(code: HostErrorCode, message: string) {
    super(message);
    this.name = "HostError";
    this.code = code;
  }
}
