/**
 * Flow draft·revision·deployment·run HTTP 스키마.
 */
import { z } from "zod";

export const draftSaveSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  definition: z.unknown(),
  triggers: z.array(z.unknown()),
  connections: z.array(z.unknown()),
  executionPolicy: z
    .object({
      mode: z.enum(["live", "dry-run"]),
      captureRaw: z.boolean(),
    })
    .optional(),
});

export const editorSaveSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  positions: z.record(z.object({ x: z.number(), y: z.number() })),
  groups: z.array(z.unknown()).optional(),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
});

export const flowRenameSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const startRunRequestSchema = z.object({
  input: z.unknown(),
  mode: z.enum(["auto", "manual"]).default("auto"),
  idempotencyKey: z.string().min(1),
});

export const effectResponseSchema = z.object({
  source: z.enum(["live", "fixture", "recorded", "simulated"]),
  status: z.enum(["succeeded", "failed", "unknown"]),
  value: z.unknown().optional(),
  error: z.unknown().optional(),
  reason: z.string().optional(),
});

export const effectFixtureSchema = z.object({
  nodeId: z.string().min(1),
  index: z.number().int().nonnegative(),
  adapter: z.string().optional(),
  operation: z.string().optional(),
  input: z.unknown().optional(),
  at: z.number().optional(),
  order: z.number().optional(),
  response: effectResponseSchema,
});

export const testSessionRequestSchema = z.object({
  source: z.enum(["draft", "revision", "run"]),
  revisionId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  input: z.unknown(),
  fixtures: z.array(effectFixtureSchema).default([]),
  progression: z.enum(["auto", "manual"]).default("auto"),
  initialState: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().min(1),
});

export const runCommandRequestSchema = z.object({
  type: z.enum(["step", "continue", "pause", "resume", "cancel", "fixture"]),
  commandId: z.string().min(1),
  effectId: z.string().min(1).optional(),
  response: effectResponseSchema.optional(),
});

export const deployRequestSchema = z.object({
  revisionId: z.string().min(1),
  rollback: z.boolean().optional(),
  stateEpoch: z.enum(["reset", "keep"]).optional(),
});

export const runSummarySchema = z.object({
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

export type DraftSave = z.infer<typeof draftSaveSchema>;
export type EditorSave = z.infer<typeof editorSaveSchema>;
export type FlowRename = z.infer<typeof flowRenameSchema>;
export type RunSummary = z.infer<typeof runSummarySchema>;
export type EffectFixture = z.infer<typeof effectFixtureSchema>;
export type TestSessionRequest = z.infer<typeof testSessionRequestSchema>;
export type RunCommandRequest = z.infer<typeof runCommandRequestSchema>;
export type DeployRequest = z.infer<typeof deployRequestSchema>;
