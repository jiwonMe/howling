#!/usr/bin/env node
/**
 * 테스트 CA를 만들고 E2E Compose + Playwright를 실행한다.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cert = join(root, "infra/tls/generated/howling.test.crt");

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", cwd: root });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

const oidc = await run("pnpm", ["--filter", "@howling/oidc-test", "build"]);
if (oidc !== 0) {
  process.exit(oidc);
}

if (!existsSync(cert)) {
  const generated = await run("node", ["infra/tls/generate.mjs"]);
  if (generated !== 0) {
    process.exit(generated);
  }
}

const compose = [
  "compose",
  "-f",
  "infra/compose/compose.e2e.yaml",
];

await run("docker", [...compose, "down", "-v", "--remove-orphans"]);
const code = await run("docker", [
  ...compose,
  "up",
  "--build",
  "--abort-on-container-exit",
  "--exit-code-from",
  "playwright",
]);
await run("docker", [...compose, "down", "-v", "--remove-orphans"]);
process.exit(code);
