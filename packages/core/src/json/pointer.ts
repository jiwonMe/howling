/**
 * RFC 6901 JSON Pointer.
 * 경로 없음(found: false)과 값이 null인 상태를 구분한다.
 */
import type { JsonPointer, JsonValue } from "../contracts/json.js";

export type PointerLookup =
  | { readonly found: true; readonly value: JsonValue }
  | { readonly found: false };

const decodeToken = (token: string): string =>
  token.replaceAll("~1", "/").replaceAll("~0", "~");

export const splitPointer = (pointer: JsonPointer): string[] | undefined => {
  if (pointer === "") {
    return [];
  }
  if (!pointer.startsWith("/")) {
    return undefined;
  }
  return pointer.slice(1).split("/").map(decodeToken);
};

export const getByPointer = (
  root: JsonValue,
  pointer: JsonPointer,
): PointerLookup => {
  const tokens = splitPointer(pointer);
  if (tokens === undefined) {
    return { found: false };
  }
  let current: JsonValue = root;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      // 선행 0이 있는 인덱스는 RFC상 무효다.
      if (!/^(0|[1-9][0-9]*)$/.test(token)) {
        return { found: false };
      }
      const index = Number(token);
      if (index >= current.length) {
        return { found: false };
      }
      const next = current[index];
      if (next === undefined) {
        return { found: false };
      }
      current = next;
      continue;
    }
    if (current === null || typeof current !== "object") {
      return { found: false };
    }
    if (!Object.hasOwn(current, token)) {
      return { found: false };
    }
    const next = current[token];
    if (next === undefined) {
      return { found: false };
    }
    current = next;
  }
  return { found: true, value: current };
};
