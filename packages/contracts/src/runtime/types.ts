/**
 * 이후 단계에서 채울 runtime 메시지 이름.
 * 단계 0에서는 연결 계열만 구현한다.
 */
export const reservedRuntimeMessageTypes = [
  "hello",
  "heartbeat",
  "heartbeat.ack",
  "capabilities",
  "desired.deployment",
  "activation.result",
  "run.start",
  "run.step",
  "run.pause",
  "run.resume",
  "run.cancel",
  "connections.snapshot",
  "catalog.snapshot",
  "summary.batch",
  "summary.ack",
  "raw.batch",
  "raw.ack",
  "detail.request",
  "detail.response",
] as const;

export type ReservedRuntimeMessageType =
  (typeof reservedRuntimeMessageTypes)[number];
