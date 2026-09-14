/**
 * API와 runtime이 주고받는 공통 envelope.
 */
import { z } from "zod";

export const runtimeEnvelopeSchema = z.object({
  protocolVersion: z.literal(1),
  messageId: z.string().min(1),
  runtimeId: z.string().min(1),
  siteId: z.string().min(1),
  connectionGeneration: z.number().int().nonnegative(),
  correlationId: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  type: z.string().min(1),
  payload: z.unknown(),
});

export type RuntimeEnvelope<T = unknown> = {
  readonly protocolVersion: 1;
  readonly messageId: string;
  readonly runtimeId: string;
  readonly siteId: string;
  readonly connectionGeneration: number;
  readonly correlationId?: string;
  readonly expiresAt?: string;
  readonly type: string;
  readonly payload: T;
};

export const parseRuntimeEnvelope = (value: unknown): RuntimeEnvelope =>
  runtimeEnvelopeSchema.parse(value) as RuntimeEnvelope;
