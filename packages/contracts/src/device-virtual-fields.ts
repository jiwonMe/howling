/**
 * 가상 기기 여러 값. entity_id는 받지 않는다.
 */
import { z } from "zod";
import type { DeviceActionField } from "./device-services-types.js";

export const FIELDS_ATTR = "__fields";

export const virtualFieldTypeSchema = z.enum(["boolean", "number", "text", "select"]);

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((key) => key !== FIELDS_ATTR && key !== "entity_id" && key !== "entityId" && !key.includes("."));

const fieldShape = {
  key: keySchema,
  label: z.string().trim().min(1).max(64).optional(),
  type: virtualFieldTypeSchema,
  options: z.array(z.string().trim().min(1).max(64)).min(2).max(24).optional(),
};

const needSelectOptions = (
  field: { readonly type: string; readonly options?: readonly string[] | undefined },
  ctx: z.RefinementCtx,
): void => {
  if (field.type === "select" && (field.options?.length ?? 0) < 2) {
    ctx.addIssue({ code: "custom", message: "선택 항목이 필요합니다." });
  }
};

export const virtualFieldSchema = z.object(fieldShape).strict().superRefine(needSelectOptions);

export const virtualFieldStateSchema = z
  .object({
    ...fieldShape,
    value: z.union([z.string().max(64), z.number(), z.boolean()]).optional(),
  })
  .strict()
  .superRefine(needSelectOptions);

export const virtualFieldsSchema = z
  .array(virtualFieldSchema)
  .min(1)
  .max(16)
  .refine((items) => new Set(items.map((item) => item.key)).size === items.length, "필드 이름이 겹칩니다.");

export type VirtualFieldType = z.infer<typeof virtualFieldTypeSchema>;
export type VirtualField = z.infer<typeof virtualFieldSchema>;
export type VirtualFieldState = z.infer<typeof virtualFieldStateSchema>;

export const initialValueOf = (field: VirtualField): string | number | boolean => {
  if (field.type === "boolean") {
    return false;
  }
  if (field.type === "number") {
    return 0;
  }
  if (field.type === "select") {
    return field.options?.[0] ?? "";
  }
  return "";
};

export const initialAttrsOf = (fields: readonly VirtualField[]): Record<string, string | number | boolean> => {
  const attrs: Record<string, string | number | boolean> = {
    [FIELDS_ATTR]: JSON.stringify(fields),
  };
  for (const field of fields) {
    attrs[field.key] = initialValueOf(field);
  }
  return attrs;
};

export const fieldsFromAttrs = (attrs: Record<string, string | number | boolean>): VirtualField[] => {
  const raw = attrs[FIELDS_ATTR];
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = virtualFieldsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export const valueAttrsOf = (
  attrs: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== FIELDS_ATTR));

export const stateFromFields = (
  attrs: Record<string, string | number | boolean>,
  fields: readonly VirtualField[],
): string => {
  const named = fields.find((item) => item.key === "state");
  if (named) {
    return String(attrs[named.key] ?? "");
  }
  const first = fields[0];
  if (!first) {
    return "ok";
  }
  const value = attrs[first.key];
  if (first.type === "boolean") {
    return value ? "on" : "off";
  }
  return String(value ?? "");
};

export const coerceFieldValue = (
  field: VirtualField,
  raw: string | number | boolean,
): string | number | boolean | undefined => {
  if (field.type === "boolean") {
    return raw === true || raw === "true" || raw === "on";
  }
  if (field.type === "number") {
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const text = String(raw).slice(0, 64);
  if (field.type === "select" && field.options && !field.options.includes(text)) {
    return undefined;
  }
  return text;
};

export const applyFieldData = (
  attrs: Record<string, string | number | boolean>,
  fields: readonly VirtualField[],
  data: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> => {
  const next = { ...attrs };
  for (const field of fields) {
    const raw = data[field.key];
    if (raw === undefined) {
      continue;
    }
    const coerced = coerceFieldValue(field, raw);
    if (coerced !== undefined) {
      next[field.key] = coerced;
    }
  }
  return next;
};

export const publicFieldsOf = (
  attrs: Record<string, string | number | boolean>,
): VirtualFieldState[] =>
  fieldsFromAttrs(attrs).map((field) => ({
    ...field,
    ...(attrs[field.key] === undefined ? {} : { value: attrs[field.key] }),
  }));

export const actionFieldsOf = (fields: readonly VirtualField[] | undefined): DeviceActionField[] =>
  (fields ?? []).map((field) => ({
    key: field.key,
    label: field.label ?? field.key,
    type: field.type,
    required: true,
    ...(field.options ? { options: field.options.map((item) => ({ key: item, name: item })) } : {}),
  }));

export const readingFromFields = (
  attrs: Record<string, string | number | boolean>,
  fields: readonly VirtualField[],
): string | undefined => {
  if (fields.length === 0) {
    return undefined;
  }
  return fields
    .slice(0, 3)
    .map((field) => {
      const value = attrs[field.key];
      const label = field.label ?? field.key;
      if (field.type === "boolean") {
        return `${label} ${value ? "켜짐" : "꺼짐"}`;
      }
      return `${label} ${value ?? "—"}`;
    })
    .join(" · ");
};
