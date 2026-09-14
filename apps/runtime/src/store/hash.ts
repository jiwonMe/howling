/**
 * 로컬 저장용 digest.
 */
import { createHash } from "node:crypto";

export const sha256Json = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
