/**
 * 기기 이름 변경·삭제. entity_id는 없다.
 */
import { z } from "zod";
import { deviceSummarySchema } from "./devices.js";
import { looksLikeEntityId } from "./device-state.js";

const deviceNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => !looksLikeEntityId(value), "entity id는 넣을 수 없습니다.");

export const deviceUpdateBodySchema = z.object({
  name: deviceNameSchema,
});

export const deviceUpdateRequestSchema = deviceUpdateBodySchema.and(
  z.object({
    requestId: z.string().min(1),
    deviceId: z.string().min(1),
  }),
);

export const deviceUpdateResultSchema = z
  .object({
    requestId: z.string().min(1),
    device: deviceSummarySchema.optional(),
    error: z.string().min(1).optional(),
  })
  .strict();

export const deviceDeleteRequestSchema = z.object({
  requestId: z.string().min(1),
  deviceId: z.string().min(1),
});

export const deviceDeleteResultSchema = z
  .object({
    requestId: z.string().min(1),
    deviceId: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
  })
  .strict();

export type DeviceUpdateBody = z.infer<typeof deviceUpdateBodySchema>;
export type DeviceUpdateRequest = z.infer<typeof deviceUpdateRequestSchema>;
export type DeviceUpdateResult = z.infer<typeof deviceUpdateResultSchema>;
export type DeviceDeleteRequest = z.infer<typeof deviceDeleteRequestSchema>;
export type DeviceDeleteResult = z.infer<typeof deviceDeleteResultSchema>;
