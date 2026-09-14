/**
 * 키를 정렬한 결정적 직렬화.
 * fingerprint와 command digest가 객체 키 순서에 흔들리지 않게 한다.
 */
import type { JsonValue } from "../contracts/json.js";

export const canonicalizeJson = (value: JsonValue): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const fields = keys.map((key) => {
    const field = value[key];
    return `${JSON.stringify(key)}:${field === undefined ? "null" : canonicalizeJson(field)}`;
  });
  return `{${fields.join(",")}}`;
};
