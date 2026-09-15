/**
 * 가상 기기 YAML. entity_id는 받지 않는다.
 */
import { parse } from "yaml";
import { productIdOf } from "./device-products.js";
import { DEVICE_KIND_LABELS, deviceCreateBodySchema, deviceKindSchema, type DeviceCreateBody, type DeviceKind } from "./devices.js";

const KIND_OF: Readonly<Record<string, DeviceKind>> = {
  ...Object.fromEntries(deviceKindSchema.options.map((kind) => [kind, kind])),
  ...Object.fromEntries(
    Object.entries(DEVICE_KIND_LABELS).flatMap(([kind, label]) =>
      kind === "boolean" ? [] : [[label, kind as DeviceKind]],
    ),
  ),
  스위치: "boolean",
  input_boolean: "boolean",
  input_number: "number",
  media_player: "player",
  binary_sensor: "binary",
  input_button: "button",
  input_select: "select",
};

export const parseVirtualDevicesYaml = (text: string): DeviceCreateBody[] => {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch {
    throw new Error("YAML 형식이 올바르지 않습니다.");
  }
  const items = rowsOf(raw);
  if (items.length === 0) {
    throw new Error("이름과 종류가 있는 기기가 없습니다.");
  }
  if (items.length > 32) {
    throw new Error("한 번에 32개까지 넣을 수 있습니다.");
  }
  const parsed = items.map(itemOf);
  if (parsed.some((item) => item.name.includes("."))) {
    throw new Error("이름에 점을 넣을 수 없습니다.");
  }
  return parsed;
};

const rowsOf = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (!raw || typeof raw !== "object") {
    return raw === undefined || raw === null ? [] : [raw];
  }
  const row = raw as Record<string, unknown>;
  if (Array.isArray(row.devices)) {
    return row.devices;
  }
  return [...booleansOf(row.input_boolean), ...numbersOf(row.input_number)];
};

const booleansOf = (raw: unknown): unknown[] => {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  return Object.entries(raw as Record<string, unknown>).map(([key, value]) =>
    named(value, key, "boolean"),
  );
};

const numbersOf = (raw: unknown): unknown[] => {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  return Object.entries(raw as Record<string, unknown>).map(([key, value]) => {
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      ...named(value, key, "number"),
      ...(typeof row.min === "number" ? { min: row.min } : {}),
      ...(typeof row.max === "number" ? { max: row.max } : {}),
      ...(typeof row.step === "number" ? { step: row.step } : {}),
    };
  });
};

const named = (value: unknown, key: string, kind: "boolean" | "number") => {
  if (typeof value === "string") {
    return { name: value, kind };
  }
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const name = typeof row.name === "string" ? row.name : key.replaceAll("_", " ");
  return { name, kind };
};

const itemOf = (item: unknown): DeviceCreateBody => {
  if (!item || typeof item !== "object") {
    throw new Error("이름과 종류가 있는 기기가 없습니다.");
  }
  const row = item as Record<string, unknown>;
  const productRaw = String(row.product ?? "").trim();
  const kindRaw = String(row.kind ?? "").trim();
  if (productRaw && kindRaw) {
    throw new Error("제품과 종류를 함께 넣을 수 없습니다.");
  }
  const product = productRaw ? productIdOf(productRaw) : undefined;
  if (productRaw && !product) {
    throw new Error("알 수 없는 제품입니다.");
  }
  const kind = kindRaw ? KIND_OF[kindRaw] : undefined;
  if (kindRaw && !kind) {
    throw new Error("종류 또는 제품을 넣어 주세요.");
  }
  const parsed = deviceCreateBodySchema.safeParse({
    name: row.name,
    ...(product ? { product } : {}),
    ...(kind ? { kind } : {}),
    ...(typeof row.min === "number" ? { min: row.min } : {}),
    ...(typeof row.max === "number" ? { max: row.max } : {}),
    ...(typeof row.step === "number" ? { step: row.step } : {}),
  });
  if (!parsed.success) {
    throw new Error("이름과 종류가 있는 기기가 없습니다.");
  }
  return parsed.data;
};
