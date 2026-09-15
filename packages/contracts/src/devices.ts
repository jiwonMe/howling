/**
 * Howling 기기 카탈로그. entity_id는 여기에 없다.
 */
import { z } from "zod";

export const deviceKindSchema = z.enum(["number", "light", "switch", "boolean", "fan"]);

export const deviceActionSchema = z.enum(["turn_on", "turn_off", "toggle"]);

export const deviceSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: deviceKindSchema,
    actions: z.array(deviceActionSchema),
    numeric: z.boolean(),
    available: z.boolean(),
  })
  .strict();

export const devicesSnapshotSchema = z.object({
  devices: z.array(deviceSummarySchema),
});

export const deviceTriggerConfigSchema = z.object({
  deviceId: z.string().min(1),
  inputKey: z.string().min(1),
});

export const deviceActionRequestSchema = z.object({
  deviceId: z.string().min(1),
  action: deviceActionSchema,
});

export type DeviceKind = z.infer<typeof deviceKindSchema>;
export type DeviceAction = z.infer<typeof deviceActionSchema>;
export type DeviceSummary = z.infer<typeof deviceSummarySchema>;
export type DevicesSnapshot = z.infer<typeof devicesSnapshotSchema>;
export type DeviceTriggerConfig = z.infer<typeof deviceTriggerConfigSchema>;
export type DeviceActionRequest = z.infer<typeof deviceActionRequestSchema>;
