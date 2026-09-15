/**
 * Howling에서 연결할 수 있는 집 기기. 사용자는 허브 내부 이름을 보지 않는다.
 */
import { z } from "zod";
import { deviceSummarySchema } from "./devices.js";

export const DEVICE_INTEGRATIONS = [
  { id: "hue", name: "Philips Hue", hint: "브리지에 있는 전구와 스위치" },
  { id: "tradfri", name: "IKEA TRÅDFRI", hint: "게이트웨이와 보안 코드" },
  { id: "tplink", name: "TP-Link", hint: "Kasa·Tapo 플러그와 전구" },
  { id: "tuya", name: "Tuya / Smart Life", hint: "제조사 계정으로 연결" },
  { id: "yeelight", name: "Yeelight", hint: "같은 네트워크의 전구" },
  { id: "wiz", name: "WiZ", hint: "같은 네트워크의 전구" },
  { id: "lifx", name: "LIFX", hint: "같은 네트워크의 전구" },
  { id: "nanoleaf", name: "Nanoleaf", hint: "패널과 전구" },
  { id: "govee", name: "Govee", hint: "제조사 계정으로 연결" },
  { id: "meross", name: "Meross", hint: "플러그와 스위치" },
  { id: "switchbot", name: "SwitchBot", hint: "봇과 플러그" },
  { id: "wemo", name: "Belkin Wemo", hint: "플러그와 스위치" },
  { id: "shelly", name: "Shelly", hint: "같은 네트워크의 스위치" },
  { id: "wled", name: "WLED", hint: "주소로 연결하는 LED" },
  { id: "xiaomi_miio", name: "Xiaomi", hint: "미홈 기기" },
  { id: "sonos", name: "Sonos", hint: "스피커" },
  { id: "cast", name: "Google Cast", hint: "Chromecast와 스피커" },
  { id: "samsungtv", name: "Samsung TV", hint: "같은 네트워크의 TV" },
  { id: "webostv", name: "LG TV", hint: "같은 네트워크의 TV" },
  { id: "apple_tv", name: "Apple TV", hint: "같은 네트워크에서 찾습니다 · 화면 숫자" },
  { id: "homekit_controller", name: "HomeKit", hint: "HomeKit 코드가 있는 기기" },
  { id: "matter", name: "Matter", hint: "Matter 코드가 있는 기기" },
  { id: "lutron_caseta", name: "Lutron Caséta", hint: "브리지" },
  { id: "bond", name: "Bond", hint: "Bond Bridge" },
  { id: "roborock", name: "Roborock", hint: "로봇 청소기" },
] as const;

export const VIRTUAL_DEVICE = {
  id: "virtual",
  name: "가상 기기",
  hint: "플로 시험용 스위치·숫자. 집 기기가 아닙니다.",
} as const;

const integrationIds = DEVICE_INTEGRATIONS.map((item) => item.id);

export const deviceIntegrationIdSchema = z.enum([integrationIds[0]!, ...integrationIds.slice(1)]);

export const deviceIntegrationSchema = z.object({
  id: deviceIntegrationIdSchema,
  name: z.string().min(1),
  hint: z.string().min(1),
});

export const deviceIntegrateFieldSchema = z
  .object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(64),
    type: z.enum(["text", "password", "select"]),
    required: z.boolean(),
    options: z.array(z.object({ key: z.string().min(1), name: z.string().min(1) })).optional(),
    placeholder: z.string().max(128).optional(),
  })
  .strict();

const integrateFields = {
  list: z.boolean().optional(),
  integration: deviceIntegrationIdSchema.optional(),
  token: z.string().min(1).optional(),
  values: z
    .record(z.string().max(64), z.union([z.string().max(256), z.number(), z.boolean()]))
    .optional(),
};

const hasIntegrateTarget = (body: {
  readonly list?: boolean | undefined;
  readonly integration?: string | undefined;
  readonly token?: string | undefined;
}): boolean => body.list === true || Boolean(body.integration) || Boolean(body.token);

export const deviceIntegrateBodySchema = z.object(integrateFields).refine(hasIntegrateTarget);

export const deviceIntegrateRequestSchema = z
  .object({
    ...integrateFields,
    requestId: z.string().min(1),
  })
  .refine(hasIntegrateTarget);

export const deviceIntegrateResultSchema = z
  .object({
    requestId: z.string().min(1),
    status: z.enum(["pick", "form", "done", "error"]),
    token: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    submitLabel: z.string().min(1).optional(),
    fields: z.array(deviceIntegrateFieldSchema).optional(),
    options: z.array(z.object({ key: z.string().min(1), name: z.string().min(1) })).optional(),
    devices: z.array(deviceSummarySchema).optional(),
    error: z.string().min(1).optional(),
  })
  .strict();

export type DeviceIntegrationId = z.infer<typeof deviceIntegrationIdSchema>;
export type DeviceIntegration = (typeof DEVICE_INTEGRATIONS)[number];
export type DeviceIntegrateField = z.infer<typeof deviceIntegrateFieldSchema>;
export type DeviceIntegrateBody = z.infer<typeof deviceIntegrateBodySchema>;
export type DeviceIntegrateRequest = z.infer<typeof deviceIntegrateRequestSchema>;
export type DeviceIntegrateResult = z.infer<typeof deviceIntegrateResultSchema>;

export const deviceIntegrationOf = (id: string): DeviceIntegration | undefined =>
  DEVICE_INTEGRATIONS.find((item) => item.id === id);
