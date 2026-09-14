/**
 * 토큰 해시와 비교.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const randomToken = (): string => randomBytes(32).toString("hex");

export const sameToken = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
