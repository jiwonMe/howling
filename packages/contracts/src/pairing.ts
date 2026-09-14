/**
 * Runtime pairing DTO.
 */
import { z } from "zod";

export const pairingCreateResponseSchema = z.object({
  pairingId: z.string().min(1),
  code: z.string().min(4),
  runtimeSecret: z.string().min(8),
  expiresAt: z.string().min(1),
});

export const pairingClaimRequestSchema = z.object({
  code: z.string().min(4),
});

export const pairingClaimResponseSchema = z.object({
  pairingId: z.string().min(1),
  runtimeId: z.string().min(1),
});

export const pairingCompleteResponseSchema = z.object({
  status: z.enum(["pending", "claimed", "ready"]),
  token: z.string().min(1).optional(),
  runtimeId: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
});

export type PairingCreateResponse = z.infer<typeof pairingCreateResponseSchema>;
export type PairingCompleteResponse = z.infer<typeof pairingCompleteResponseSchema>;
