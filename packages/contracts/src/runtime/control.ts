/**
 * 배포·실행 WSS payload.
 */
import { z } from "zod";

export const desiredDeploymentSchema = z.object({
  deploymentId: z.string().min(1),
  generation: z.number().int().positive(),
  artifact: z.unknown(),
  rollback: z.boolean().optional(),
  deactivate: z.boolean().optional(),
  stateEpoch: z.enum(["reset", "keep"]).optional(),
});

export const activationResultSchema = z.object({
  deploymentId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  status: z.enum(["active", "failed", "ignored", "inactive"]),
  error: z.string().optional(),
});

export const runStartPayloadSchema = z.object({
  artifactId: z.string().min(1),
  flowId: z.string().min(1),
  input: z.unknown(),
  mode: z.enum(["auto", "manual"]),
  idempotencyKey: z.string().min(1),
  runMode: z.enum(["live", "dryRun"]).default("live"),
  runId: z.string().min(1).optional(),
  fixtures: z.array(z.unknown()).optional(),
  fixtureBundleVersion: z.string().optional(),
  initialState: z.unknown().optional(),
  testSessionId: z.string().optional(),
  artifact: z.unknown().optional(),
});

export const runCommandPayloadSchema = z.object({
  runId: z.string().min(1),
  type: z.enum(["step", "continue", "pause", "resume", "cancel", "fixture"]),
  commandId: z.string().min(1),
  effectId: z.string().min(1).optional(),
  response: z.unknown().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const summaryItemSchema = z.object({
  sequence: z.number().int().nonnegative(),
  type: z.string().min(1),
  nodeId: z.string().optional(),
  status: z.string().optional(),
});

export const summaryBatchSchema = z.object({
  runtimeId: z.string().min(1),
  stream: z.literal("summary"),
  syncSeq: z.number().int().positive(),
  runId: z.string().min(1),
  flowId: z.string().min(1),
  revisionId: z.string().min(1),
  status: z.string().min(1),
  lastSeq: z.number().int().nonnegative(),
  trigger: z.unknown().nullable().optional(),
  items: z.array(summaryItemSchema),
  runMode: z.enum(["live", "dryRun"]).optional(),
});

export const summaryAckSchema = z.object({
  runtimeId: z.string().min(1),
  stream: z.enum(["summary", "raw", "observe"]),
  syncSeq: z.number().int().positive(),
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
  mcp: z
    .object({
      status: z.string(),
      servers: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          status: z.string(),
          tools: z.array(
            z.object({
              connectionId: z.string().min(1),
              tool: z.string().min(1),
              inputSchemaDigest: z.string().min(1),
              title: z.string().optional(),
            }),
          ),
        }),
      ),
    })
    .optional(),
});
