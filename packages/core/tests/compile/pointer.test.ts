/** JSON Pointer: 빈 path, escape, 누락과 null 구분. */
import { describe, expect, it } from "vitest";
import { getByPointer } from "../../src/json/pointer.js";

describe("JSON pointer", () => {
  it("treats an empty pointer as the whole value", () => {
    expect(getByPointer({ a: 1 }, "")).toEqual({ found: true, value: { a: 1 } });
  });

  it("reads nested fields and array indexes", () => {
    expect(getByPointer({ readings: [{ value: 7 }] }, "/readings/0/value")).toEqual({
      found: true,
      value: 7,
    });
  });

  it("decodes escaped tokens", () => {
    expect(getByPointer({ "a/b": { "~c": 1 } }, "/a~1b/~0c")).toEqual({ found: true, value: 1 });
  });

  it("distinguishes missing fields from null", () => {
    expect(getByPointer({ value: null }, "/value")).toEqual({ found: true, value: null });
    expect(getByPointer({ value: null }, "/missing")).toEqual({ found: false });
  });
});
