/**
 * ALL·ANY의 동적 포트 이름.
 * 중복이거나 error 예약어를 쓰면 거부한다.
 */
import type { JsonObject } from "../contracts/json.js";
import { ERROR_PORT } from "../nodes/reserved.js";

export const readInputNames = (config: JsonObject): string[] | undefined => {
  const names = config.inputNames;
  if (!Array.isArray(names) || names.length === 0) {
    return undefined;
  }
  const values: string[] = [];
  for (const name of names) {
    if (typeof name !== "string" || name.length === 0) {
      return undefined;
    }
    values.push(name);
  }
  if (new Set(values).size !== values.length) {
    return undefined;
  }
  if (values.includes(ERROR_PORT)) {
    return undefined;
  }
  return values;
};
