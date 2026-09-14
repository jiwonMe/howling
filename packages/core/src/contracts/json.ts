/**
 * 실행 데이터의 최소 단위.
 * undefined, NaN, Infinity, 함수, class 인스턴스는 허용하지 않는다.
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

/** 이름 있는 JSON 객체. 배열은 하나의 JsonValue로 취급한다. */
export type JsonObject = { readonly [key: string]: JsonValue };

/**
 * RFC 6901 JSON Pointer.
 * 빈 문자열은 전체 값, `/temperature`는 필드, `/a~1b`는 키 `a/b`다.
 */
export type JsonPointer = string;

/** 내부에서만 쓰는 가변 객체. 공개 상태에는 넣지 않는다. */
export type MutableJsonObject = { [key: string]: JsonValue };
