#!/usr/bin/env node
/**
 * tsc는 .css를 내보내지 않으므로 setup 화면 자산을 dist로 복사한다.
 */
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src/setup/assets");
const target = join(root, "dist/setup/assets");

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
