/**
 * 배포·실행 WSS payload.
 */
import { z } from "zod";

export const desiredDeploymentSchema = z.object({
  deploymentId: z.string().min(1),
  generation: z.number().int().positive(),
  artifact: z.unknown(),
});

export const activationResultSchema = z.object({
  deploymentId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  status: z.enum(["active", "failed", "ignored"]),
  error: z.string().optional(),
});

export const runStartPayloadSchema = z.object({
  artifactId: z.string().min(1),
  flowId: z.string().min(1),
  input: z.unknown(),
  mode: z.enum(["auto", "manual"]),
  idempotencyKey: z.string().min(1),
});

export const runSummaryPayloadSchema = z.object({
  runId: z.string().min(1),
  flowId: z.string().min(1),
  revisionId: z.string().min(1),
  status: z.string().min(1),
  lastSeq: z.number().int().nonnegative(),
  trigger: z.unknown().nullable(),
  events: z.array(
    z.object({
      sequence: z.number(),
      type: z.string(),
      nodeId: z.string().optional(),
    }),
  ),
});

export const connectionsSnapshotSchema = z.object({
  ha: z.object({
    status: z.string(),
    lastSyncAt: z.string().nullable().optional(),
  }),
});
