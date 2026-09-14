/**
 * Runtime 자격증명은 DB가 아니라 env 또는 파일에서 읽는다.
 */
import { readFileSync } from "node:fs";
import type { RuntimeConfig } from "./config.js";

export const readRuntimeToken = (config: RuntimeConfig): string => {
  if (config.tokenFile) {
    return readFileSync(config.tokenFile, "utf8").trim();
  }
  return config.token;
};
