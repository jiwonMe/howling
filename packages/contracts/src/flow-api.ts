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

export const startRunRequestSchema = z.object({
  input: z.unknown(),
  mode: z.enum(["auto", "manual"]).default("auto"),
  idempotencyKey: z.string().min(1),
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
export type RunSummary = z.infer<typeof runSummarySchema>;
