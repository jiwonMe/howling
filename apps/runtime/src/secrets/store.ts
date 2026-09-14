/**
 * Secret은 SQLite가 아니라 제한된 파일에 둔다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const secretPath = (root: string, name: string): string =>
  join(root, "secrets", name);

export const writeSecret = (root: string, name: string, value: string): void => {
  const path = secretPath(root, name);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, value, { mode: 0o600 });
};

export const readSecret = (root: string, name: string): string | undefined => {
  try {
    return readFileSync(secretPath(root, name), "utf8").trim();
  } catch {
    return undefined;
  }
};
