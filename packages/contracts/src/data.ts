/**
 * 원본 보관·관측 필드·차트 집계. payload 원문은 넣지 않는다.
 */
import { z } from "zod";

export const GIB = 1024 * 1024 * 1024;

export const DEFAULT_DATA_POLICY = {
  localRetentionDays: 7,
  cloudSummaryDays: 30,
  cloudRawDays: 7,
  capacityBytes: GIB,
  defaultCaptureRaw: false,
} as const;

export const siteDataPolicySchema = z.object({
  localRetentionDays: z.number().int().positive().max(365),
  cloudSummaryDays: z.number().int().positive().max(365),
  cloudRawDays: z.number().int().positive().max(365),
  capacityBytes: z.number().int().positive(),
  defaultCaptureRaw: z.boolean(),
});

export const observationFieldSchema = z.object({
  id: z.string().min(1),
  flowId: z.string().min(1),
  nodeId: z.string().min(1),
  pointer: z.string().min(1),
  sampleIntervalMs: z.number().int().positive().optional(),
});

export const observationSpecSchema = z.object({
  fields: z.array(observationFieldSchema),
});

export const observeSampleSchema = z.object({
  fieldId: z.string().min(1),
  ts: z.string().datetime(),
  value: z.number(),
  kind: z.enum(["sample", "mean", "count"]),
  runId: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
});

export const analyticsSeriesPointSchema = z.object({
  ts: z.string().min(1),
  value: z.number(),
});

export const analyticsSnapshotSchema = z.object({
  resync: z.boolean().optional(),
  series: z.array(
    z.object({
      fieldId: z.string().min(1),
      points: z.array(analyticsSeriesPointSchema),
    }),
  ),
  runCounts: z.object({
    total: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  nodeDurations: z.array(
    z.object({
      nodeId: z.string().min(1),
      events: z.number().int().nonnegative(),
    }),
  ),
  recentErrors: z.array(
    z.object({
      runId: z.string().min(1),
      type: z.string().min(1),
      nodeId: z.string().optional(),
    }),
  ),
});

export const detailRequestBodySchema = z.object({
  nodeId: z.string().min(1).optional(),
  field: z.string().min(1).optional(),
  sequence: z.number().int().nonnegative().optional(),
});

export const MCP_OAUTH_PRESETS = [
  { id: "custom", name: "직접 입력" },
  {
    id: "github",
    name: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
  },
] as const;

export type SiteDataPolicy = z.infer<typeof siteDataPolicySchema>;
export type ObservationSpec = z.infer<typeof observationSpecSchema>;
export type ObservationField = z.infer<typeof observationFieldSchema>;
export type ObserveSample = z.infer<typeof observeSampleSchema>;
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
