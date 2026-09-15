/**
 * summary와 분리된 raw·observe cursor와 일회성 상세 조회.
 */
import { z } from "zod";
import {
  observeSampleSchema,
  observationSpecSchema,
  siteDataPolicySchema,
} from "../data.js";

export const syncStreamSchema = z.enum(["summary", "raw", "observe"]);

export const streamAckSchema = z.object({
  runtimeId: z.string().min(1),
  stream: syncStreamSchema,
  syncSeq: z.number().int().positive(),
});

export const rawItemSchema = z.object({
  sequence: z.number().int().nonnegative(),
  type: z.string().min(1),
  nodeId: z.string().optional(),
  fields: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])),
});

export const rawBatchSchema = z.object({
  runtimeId: z.string().min(1),
  stream: z.literal("raw"),
  syncSeq: z.number().int().positive(),
  runId: z.string().min(1),
  flowId: z.string().min(1),
  revisionId: z.string().min(1),
  capturedAt: z.string().datetime(),
  items: z.array(rawItemSchema),
  tombstone: z.boolean().optional(),
});

export const observeBatchSchema = z.object({
  runtimeId: z.string().min(1),
  stream: z.literal("observe"),
  syncSeq: z.number().int().positive(),
  items: z.array(observeSampleSchema),
  tombstone: z.boolean().optional(),
});

export const detailRequestSchema = z.object({
  requestId: z.string().min(1),
  runId: z.string().min(1),
  nodeId: z.string().min(1).optional(),
  field: z.string().min(1).optional(),
  sequence: z.number().int().nonnegative().optional(),
});

export const detailResponseSchema = z.object({
  requestId: z.string().min(1),
  runId: z.string().min(1),
  unavailable: z.enum(["offline", "purged", "denied"]).optional(),
  value: z.unknown().optional(),
});

export const desiredDataSchema = z.object({
  captureRaw: z.boolean(),
  policy: siteDataPolicySchema,
  observations: observationSpecSchema,
});

export type SyncStream = z.infer<typeof syncStreamSchema>;
export type RawBatch = z.infer<typeof rawBatchSchema>;
export type ObserveBatch = z.infer<typeof observeBatchSchema>;
export type DetailRequest = z.infer<typeof detailRequestSchema>;
export type DetailResponse = z.infer<typeof detailResponseSchema>;
export type DesiredData = z.infer<typeof desiredDataSchema>;
