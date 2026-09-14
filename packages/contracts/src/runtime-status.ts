/**
 * 웹이 조회하는 runtime 연결 상태.
 */
import { z } from "zod";

export const haConnectionPlaceholderSchema = z.object({
  status: z.literal("not_configured"),
});

export const runtimeStatusSchema = z.object({
  siteId: z.string().min(1),
  runtimeId: z.string().min(1),
  online: z.boolean(),
  connectionGeneration: z.number().int().nonnegative(),
  lastSeenAt: z.string().datetime().nullable(),
  capabilities: z.unknown().nullable(),
  ha: haConnectionPlaceholderSchema,
});

export type RuntimeStatus = z.infer<typeof runtimeStatusSchema>;
