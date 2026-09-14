/**
 * 깊은 복사. structuredClone 대신 순수 JSON만 복제해 Node·브라우저 모두에서 동일하다.
 * 노드 간 출력은 가변 참조로 공유하지 않는다.
 */
import type { JsonObject, JsonValue } from "../contracts/json.js";
import { isJsonValue } from "./is-json.js";

export class InvalidJsonError extends Error {
  public override readonly name = "InvalidJsonError";
}

const cloneValue = (value: JsonValue): JsonValue => {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  const result: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(value)) {
    const field = value[key];
    if (field !== undefined) {
      result[key] = cloneValue(field);
    }
  }
  return result;
};

export const cloneJson = <T extends JsonValue>(value: T): T => {
  if (!isJsonValue(value)) {
    throw new InvalidJsonError("value is not JSON-safe");
  }
  return cloneValue(value) as T;
};

export const cloneJsonObject = (value: JsonObject): JsonObject => cloneJson(value);

export const tryCloneJson = (
  value: unknown,
): { ok: true; value: JsonValue } | { ok: false; message: string } => {
  if (!isJsonValue(value)) {
    return { ok: false, message: "value is not JSON-safe" };
  }
  return { ok: true, value: cloneValue(value) };
};
