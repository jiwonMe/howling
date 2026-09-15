/**
 * Tool inputSchema digest. 원문은 올리지 않는다.
 */
import { createHash } from "node:crypto";

export const schemaDigest = (schema: unknown): string =>
  createHash("sha256").update(stableJson(schema ?? {})).digest("hex");

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
