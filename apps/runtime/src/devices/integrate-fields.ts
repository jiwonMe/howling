/**
 * 허브 연결 양식을 Howling 필드로 옮긴다. 내부 id는 클라우드에 안 보낸다.
 */
import type { DeviceIntegrateField } from "@howling/contracts";

export { descriptionOf, flowErrorOf, publicIntegrateError, submitLabelOf } from "./integrate-copy.js";

const SKIP = new Set(["entity_id", "area_id", "device_id"]);

const LABELS: Readonly<Record<string, string>> = {
  host: "주소",
  ip_address: "주소",
  ip: "주소",
  bridge: "주소",
  url: "주소",
  port: "포트",
  username: "사용자 이름",
  user: "사용자 이름",
  password: "비밀번호",
  api_key: "접속 키",
  access_token: "접속 키",
  token: "접속 키",
  code: "코드",
  security_code: "코드",
  pin: "코드",
  device_input: "주소 또는 이름",
  id: "기기",
  name: "이름",
  next_step_id: "연결 방법",
};

const SECRET = new Set([
  "password",
  "api_key",
  "access_token",
  "token",
  "code",
  "security_code",
  "secret",
]);

export type FieldTypes = Map<string, "string" | "number" | "boolean">;
export type OptionMaps = Map<string, Map<string, string>>;

export type ParsedIntegrateFields = {
  readonly fields: DeviceIntegrateField[];
  readonly optionMaps: OptionMaps;
  readonly types: FieldTypes;
};

export const parseIntegrateFields = (schema: unknown): ParsedIntegrateFields => {
  const rows = Array.isArray(schema) ? schema : [];
  const optionMaps: OptionMaps = new Map();
  const types: FieldTypes = new Map();
  const fields = rows.flatMap((item) => {
    const parsed = fieldOf(item);
    if (!parsed) {
      return [];
    }
    types.set(parsed.field.key, parsed.valueType);
    if (parsed.rawOptions.size > 0) {
      optionMaps.set(parsed.field.key, parsed.rawOptions);
    }
    return [parsed.field];
  });
  return { fields, optionMaps, types };
};

export const parseMenuFields = (menu: unknown): ParsedIntegrateFields => {
  const raw = menuOptions(menu);
  if (raw.length === 0) {
    return { fields: [], optionMaps: new Map(), types: new Map() };
  }
  return parseIntegrateFields([
    {
      name: "next_step_id",
      required: true,
      options: raw.map((item) => [item.raw, item.name]),
    },
  ]);
};

export const decodeIntegrateValues = (
  values: Readonly<Record<string, string | number | boolean>> | undefined,
  optionMaps: OptionMaps,
  types: FieldTypes,
): Record<string, string | number | boolean> => {
  const decoded: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    const mapped = optionMaps.get(key)?.get(String(value));
    decoded[key] = coerceValue(mapped ?? value, types.get(key));
  }
  return decoded;
};

const fieldOf = (
  item: unknown,
): { field: DeviceIntegrateField; rawOptions: Map<string, string>; valueType: "string" | "number" | "boolean" } | undefined => {
  if (!item || typeof item !== "object" || !("name" in item)) {
    return undefined;
  }
  const row = item as {
    name?: unknown;
    required?: unknown;
    type?: unknown;
    options?: unknown;
    selector?: unknown;
  };
  if (typeof row.name !== "string" || SKIP.has(row.name)) {
    return undefined;
  }
  const options = optionsOf(row.options ?? selectOptions(row.selector));
  const valueType = typeOf(row.type, row.selector, row.name);
  const field: DeviceIntegrateField = {
    key: row.name,
    label: LABELS[row.name] ?? row.name.replaceAll("_", " "),
    type: options.length > 0 ? "select" : SECRET.has(row.name) || secretSelector(row.selector) ? "password" : "text",
    required: row.required !== false,
    ...(options.length > 0 ? { options: options.map((item) => ({ key: item.key, name: item.name })) } : {}),
  };
  return {
    field,
    rawOptions: new Map(options.map((item) => [item.key, item.raw])),
    valueType,
  };
};

const optionsOf = (
  raw: unknown,
): readonly { readonly key: string; readonly name: string; readonly raw: string }[] => {
  if (Array.isArray(raw)) {
    return raw.flatMap((item, index) => optionOf(item, index));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).flatMap(([id, name], index) =>
      optionOf([id, name], index),
    );
  }
  return [];
};

const optionOf = (
  item: unknown,
  index: number,
): readonly { readonly key: string; readonly name: string; readonly raw: string }[] => {
  if (Array.isArray(item) && typeof item[0] === "string") {
    const name = typeof item[1] === "string" ? item[1] : item[0];
    return [{ key: `o${String(index)}`, name: item[0] === "manual" ? "직접 주소 입력" : name, raw: item[0] }];
  }
  if (item && typeof item === "object" && "value" in item) {
    const row = item as { value?: unknown; label?: unknown };
    if (typeof row.value === "string") {
      const name = typeof row.label === "string" ? row.label : row.value;
      return [{ key: `o${String(index)}`, name, raw: row.value }];
    }
  }
  if (typeof item === "string") {
    return [{ key: `o${String(index)}`, name: item === "manual" ? "직접 주소 입력" : item, raw: item }];
  }
  return [];
};

const menuOptions = (menu: unknown): readonly { readonly raw: string; readonly name: string }[] => {
  if (Array.isArray(menu)) {
    return menu.flatMap((item) =>
      typeof item === "string" ? [{ raw: item, name: item.replaceAll("_", " ") }] : [],
    );
  }
  if (menu && typeof menu === "object") {
    return Object.entries(menu as Record<string, unknown>).flatMap(([raw, name]) =>
      typeof name === "string" ? [{ raw, name }] : [{ raw, name: raw.replaceAll("_", " ") }],
    );
  }
  return [];
};

const selectOptions = (selector: unknown): unknown => {
  if (!selector || typeof selector !== "object") {
    return undefined;
  }
  const select = (selector as { select?: { options?: unknown } }).select;
  return select?.options;
};

const secretSelector = (selector: unknown): boolean => {
  if (!selector || typeof selector !== "object") {
    return false;
  }
  const text = (selector as { text?: { type?: unknown } }).text;
  return text?.type === "password";
};

const typeOf = (
  type: unknown,
  selector: unknown,
  name: string,
): "string" | "number" | "boolean" => {
  if (type === "integer" || type === "number" || name === "port") {
    return "number";
  }
  if (type === "boolean" || name.startsWith("verify_")) {
    return "boolean";
  }
  if (selector && typeof selector === "object") {
    if ("number" in selector) {
      return "number";
    }
    if ("boolean" in selector) {
      return "boolean";
    }
  }
  return "string";
};

const coerceValue = (
  value: string | number | boolean,
  type: "string" | "number" | "boolean" | undefined,
): string | number | boolean => {
  if (type === "number" && typeof value === "string" && value !== "") {
    return Number(value);
  }
  if (type === "boolean") {
    return value === true || value === "true";
  }
  return value;
};
