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
  "oauth.code",
  "catalog.snapshot",
  "summary.batch",
  "summary.ack",
  "raw.batch",
  "raw.ack",
  "observe.batch",
  "observe.ack",
  "detail.request",
  "detail.response",
  "desired.data",
  "devices.snapshot",
  "devices.create",
  "devices.created",
  "devices.integrate",
  "devices.integrated",
] as const;

export type ReservedRuntimeMessageType =
  (typeof reservedRuntimeMessageTypes)[number];
