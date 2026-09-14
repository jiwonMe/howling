/**
 * 실행 artifact digest. layout은 넣지 않는다.
 */
import { createHash } from "node:crypto";

export const artifactDigest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
