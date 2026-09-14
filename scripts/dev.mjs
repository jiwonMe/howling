#!/usr/bin/env node
/**
 * postgres·oidc를 Compose로 띄운 뒤 api·runtime·web을 로컬에서 기동한다.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const composeArgs = [
  "compose",
  "-f",
  "infra/compose/compose.yaml",
  "up",
  "-d",
  "postgres",
  "oidc",
];

const compose = spawn("docker", composeArgs, { stdio: "inherit" });
const composeCode = await new Promise((resolve, reject) => {
  compose.on("error", reject);
  compose.on("exit", resolve);
});

if (composeCode !== 0) {
  throw new Error(`docker compose exited ${String(composeCode)}`);
}

const oidcUrl = "http://127.0.0.1:8081/.well-known/openid-configuration";
let ready = false;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    const response = await fetch(oidcUrl);
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    // 기동 전.
  }
  await delay(500);
}

if (!ready) {
  throw new Error("OIDC issuer did not become ready");
}

const build = spawn(
  "pnpm",
  ["--filter", "@howling/core", "--filter", "@howling/contracts", "build"],
  { stdio: "inherit" },
);
const buildCode = await new Promise((resolve, reject) => {
  build.on("error", reject);
  build.on("exit", resolve);
});
if (buildCode !== 0) {
  throw new Error(`workspace build exited ${String(buildCode)}`);
}

const children = [
  spawn("pnpm", ["--filter", "@howling/api", "dev"], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@howling/runtime", "dev"], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@howling/web", "dev"], { stdio: "inherit" }),
];

const shutdown = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
