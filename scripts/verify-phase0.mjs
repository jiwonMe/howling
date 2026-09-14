#!/usr/bin/env node
/**
 * build·typecheck·test 후 세 앱을 띄우고 health를 확인한다.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited ${String(code)}`));
    });
  });

await run("docker", [
  "compose",
  "-f",
  "infra/compose/compose.yaml",
  "up",
  "-d",
  "postgres",
  "oidc",
]);

const waitHttp = async (url) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 기동 전.
    }
    await delay(500);
  }
  throw new Error(`timeout waiting for ${url}`);
};

await waitHttp("http://127.0.0.1:8081/.well-known/openid-configuration");
await run("pnpm", ["build"]);
await run("pnpm", ["typecheck"]);
await run("pnpm", ["test"]);

const children = [
  spawn("pnpm", ["--filter", "@howling/api", "dev"], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@howling/runtime", "dev"], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@howling/web", "dev"], { stdio: "inherit" }),
];

const stop = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
};

process.on("SIGINT", () => {
  stop();
  process.exit(1);
});

try {
  await waitHttp("http://127.0.0.1:3000/ready");
  await waitHttp("http://127.0.0.1:4000/ready");
  await waitHttp("http://127.0.0.1:5173/");
  await run("bash", ["infra/compose/check-health.sh"]);
} finally {
  stop();
}
