/**
 * 동기 FNV-1a 64-bit.
 * compile은 sync라 Web Crypto를 쓰지 않는다.
 */
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export const fnv1a64 = (text: string): string => {
  let hash = OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
};
