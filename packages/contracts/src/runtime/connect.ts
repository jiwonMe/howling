/**
 * 연결 계열: hello, heartbeat, capabilities.
 */
import { z } from "zod";

/** 기본 15초. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** 45초 무응답이면 offline. 자동화 중단과 별개다. */
export const HEARTBEAT_TIMEOUT_MS = 45_000;

export const helloPayloadSchema = z.object({
  protocolVersion: z.literal(1),
  capabilities: z.object({
    connectors: z.array(z.string()),
    nodeCatalogVersion: z.string().min(1).optional(),
  }),
});

export type HelloPayload = z.infer<typeof helloPayloadSchema>;

export const heartbeatPayloadSchema = z.object({
  sentAt: z.string().datetime(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;

export const heartbeatAckPayloadSchema = z.object({
  receivedAt: z.string().datetime(),
});

export type HeartbeatAckPayload = z.infer<typeof heartbeatAckPayloadSchema>;

export const capabilitiesPayloadSchema = z.object({
  connectors: z.array(z.string()),
  nodeCatalogVersion: z.string().min(1).optional(),
});

export type CapabilitiesPayload = z.infer<typeof capabilitiesPayloadSchema>;

export const connectMessageTypeSchema = z.enum([
  "hello",
  "heartbeat",
  "heartbeat.ack",
  "capabilities",
]);

export type ConnectMessageType = z.infer<typeof connectMessageTypeSchema>;
