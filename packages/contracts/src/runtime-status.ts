/**
 * 웹이 조회하는 runtime·HA 연결 상태.
 */
import { z } from "zod";

export const haStatusSchema = z.enum([
  "not_configured",
  "configured",
  "connecting",
  "authenticating",
  "synchronizing",
  "ready",
  "error",
  "disconnected",
  "reconnecting",
]);

export const haConnectionSchema = z.object({
  status: haStatusSchema,
  lastSyncAt: z.string().datetime().nullable().optional(),
});

/** 단계 0 placeholder와 호환. */
export const haConnectionPlaceholderSchema = z.object({
  status: z.literal("not_configured"),
});

export const runtimeStatusSchema = z.object({
  siteId: z.string().min(1),
  runtimeId: z.string().min(1),
  online: z.boolean(),
  paired: z.boolean().default(true),
  connectionGeneration: z.number().int().nonnegative(),
  lastSeenAt: z.string().datetime().nullable(),
  capabilities: z.unknown().nullable(),
  ha: haConnectionSchema,
});

export type HaStatus = z.infer<typeof haStatusSchema>;
export type RuntimeStatus = z.infer<typeof runtimeStatusSchema>;
