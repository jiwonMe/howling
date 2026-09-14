/**
 * hello·heartbeat envelope 생성.
 */
import { randomUUID } from "node:crypto";
import type {
  HeartbeatPayload,
  HelloPayload,
  RuntimeEnvelope,
} from "@howling/contracts";

export const helloEnvelope = (input: {
  readonly runtimeId: string;
  readonly siteId: string;
  readonly generation: number;
}): RuntimeEnvelope<HelloPayload> => ({
  protocolVersion: 1,
  messageId: randomUUID(),
  runtimeId: input.runtimeId,
  siteId: input.siteId,
  connectionGeneration: input.generation,
  type: "hello",
  payload: {
    protocolVersion: 1,
    capabilities: { connectors: ["homeassistant"] },
  },
});

export const heartbeatEnvelope = (input: {
  readonly runtimeId: string;
  readonly siteId: string;
  readonly generation: number;
  readonly sentAt: string;
}): RuntimeEnvelope<HeartbeatPayload> => ({
  protocolVersion: 1,
  messageId: randomUUID(),
  runtimeId: input.runtimeId,
  siteId: input.siteId,
  connectionGeneration: input.generation,
  type: "heartbeat",
  payload: { sentAt: input.sentAt },
});
