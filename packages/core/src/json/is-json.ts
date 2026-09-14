/**
 * JSON 실행 데이터 가드.
 * 일반 객체만 받고 Date, Map, class 인스턴스는 거부한다.
 */
import type { JsonValue } from "../contracts/json.js";

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) {
    return true;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return true;
  }
  if (isFiniteNumber(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value !== "object") {
    return false;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }
  return Object.values(value).every(isJsonValue);
};
