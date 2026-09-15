/**
 * JSON Pointer로 숫자 sample만 고른다.
 */
export const readPointer = (value: unknown, pointer: string): unknown => {
  if (!pointer.startsWith("/")) {
    return undefined;
  }
  if (pointer === "/") {
    return value;
  }
  let current: unknown = value;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (current && typeof current === "object" && key in (current as object)) {
      current = (current as Record<string, unknown>)[key];
      continue;
    }
    return undefined;
  }
  return current;
};

export const asScalar = (
  value: unknown,
): number | string | boolean | null | undefined => {
  if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  return undefined;
};

export const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
