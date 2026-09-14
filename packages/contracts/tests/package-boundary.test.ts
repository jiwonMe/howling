/** src가 React·HA·MCP·DB·네트워크·파일 API를 import하지 않는지 검사한다. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../src");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

describe("package boundary", () => {
  it("does not import React, HA, MCP, DB, or network APIs from src", () => {
    const forbidden = [
      /from ['"]react['"]/,
      /from ['"]react-flow/,
      /home-?assistant/i,
      /@modelcontextprotocol/,
      /from ['"]node:fs['"]/,
      /from ['"]node:net['"]/,
      /from ['"]node:http['"]/,
      /from ['"]fs['"]/,
      /from ['"]net['"]/,
      /from ['"]pg['"]/,
      /from ['"]sqlite/,
      /from ['"]fastify['"]/,
    ];
    const files = walk(srcRoot).filter((path) => path.endsWith(".ts"));
    const hits = files.flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${path} matched ${pattern}`);
    });
    expect(hits).toEqual([]);
  });
});
