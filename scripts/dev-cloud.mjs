#!/usr/bin/env node
/**
 * runtime과 HA만 로컬에서 켜고 클라우드(app.howling.life)에 붙인다.
 * api·web·postgres·oidc는 띄우지 않는다. 클라우드 것을 그대로 쓴다.
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureHaSecrets, haAlive, waitForHa } from "./lib/ha-secrets.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const trim = (value) => value.replace(/\/+$/, "");

const cloud = trim(process.env.HOWLING_CLOUD ?? "https://app.howling.life");
const haUrl = trim(process.env.HA_URL ?? "http://127.0.0.1:8123");
const port = Number(process.env.RUNTIME_PORT ?? "4000");
const dataRoot = process.env.HOWLING_RUNTIME_DATA ?? join(root, "apps/runtime/data/cloud");
const skipHa = process.env.HOWLING_SKIP_HA === "1";
const wsUrl = `${cloud.replace(/^http/, "ws")}/api/v1/runtime/ws`;
const local = `http://127.0.0.1:${String(port)}`;
const setupUrl = `${local}/setup`;

const HA_TOKEN_NOTE = {
  env: "HA_TOKEN 환경변수를 저장했습니다.",
  keep: "이미 저장된 토큰을 씁니다.",
  copied: "로컬 dev runtime의 토큰을 복사했습니다.",
  onboarded: "새 HA를 온보딩하고 장기 토큰을 만들었습니다.",
  manual: `없습니다. ${setupUrl} 에서 URL과 장기 토큰을 넣으세요.`,
};

const die = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, ...options });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const okJson = async (url, init) => {
  try {
    const response = await fetch(url, init);
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
};

const startHa = async () => {
  const started = await run("docker", ["start", "howling-ha"], { stdio: "ignore" });
  if (started === 0) {
    return;
  }
  const up = await run("docker", ["compose", "-f", "infra/compose/compose.ha.yaml", "up", "-d"], {
    stdio: "inherit",
  });
  if (up !== 0) {
    die(`docker compose가 ${String(up)}로 끝났습니다.`);
  }
};

const ensureHa = async () => {
  if (await haAlive(haUrl)) {
    console.log(`[dev:cloud] HA 재사용: ${haUrl}`);
  } else {
    await startHa();
    if (!(await waitForHa(haUrl))) {
      die(`HA가 ${haUrl}에서 뜨지 않았습니다. docker logs howling-ha로 확인하세요.`);
    }
    console.log(`[dev:cloud] HA 기동: ${haUrl}`);
  }
  const state = await ensureHaSecrets({
    root: dataRoot,
    url: haUrl,
    fallbackRoot: join(root, "apps/runtime/data"),
    envToken: process.env.HA_TOKEN,
  });
  console.log(`[dev:cloud] HA 토큰: ${HA_TOKEN_NOTE[state]}`);
};

const announcePairing = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(500);
    const status = await okJson(`${local}/v1/setup/status`);
    if (!status) {
      continue;
    }
    if (status.pairing?.status === "ready") {
      console.log(`\n[dev:cloud] 이미 pairing된 runtime입니다. ${cloud}에서 online을 봅니다.\n`);
      return;
    }
    const paired = await okJson(`${local}/v1/setup/pair`, { method: "POST" });
    if (paired?.code) {
      console.log(`\n[dev:cloud] Pairing code: ${paired.code}`);
      console.log(`[dev:cloud] ${cloud}/connections 에 넣으면 붙습니다.`);
      console.log(`[dev:cloud] HA·MCP 설정은 ${setupUrl}\n`);
      return;
    }
    console.log(`\n[dev:cloud] pairing을 시작하지 못했습니다. ${setupUrl} 에서 직접 누르세요.\n`);
    return;
  }
};

if (!/^https?:\/\//.test(cloud)) {
  die(`HOWLING_CLOUD가 http(s) 주소가 아닙니다: ${cloud}`);
}

if (!(await okJson(`${cloud}/health`))) {
  die(`${cloud}에 닿지 못했습니다. 배포 상태와 네트워크를 확인하세요.`);
}

if (await okJson(`${local}/health`)) {
  die(
    `${local}에 이미 runtime이 떠 있습니다.\n` +
      `pnpm dev를 끄거나 RUNTIME_PORT=4001 pnpm dev:cloud로 다른 포트를 쓰세요.`,
  );
}

if (!skipHa) {
  await ensureHa();
}

const built = await run(
  "pnpm",
  ["--filter", "@howling/core", "--filter", "@howling/contracts", "build"],
  { stdio: "inherit" },
);
if (built !== 0) {
  die(`workspace build가 ${String(built)}로 끝났습니다.`);
}

console.log(`\n[dev:cloud] runtime → ${wsUrl}`);
console.log(`[dev:cloud] 데이터·secret → ${dataRoot}`);

const runtime = spawn("pnpm", ["--filter", "@howling/runtime", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    RUNTIME_HOST: process.env.RUNTIME_HOST ?? "127.0.0.1",
    RUNTIME_PORT: String(port),
    RUNTIME_API_URL: wsUrl,
    RUNTIME_API_HTTP: cloud,
    RUNTIME_SQLITE_PATH: join(dataRoot, "runtime.sqlite"),
    RUNTIME_SECRET_ROOT: dataRoot,
    // 클라우드는 bootstrap token을 쓰지 않는다. pairing으로만 붙는다.
    RUNTIME_TOKEN: process.env.RUNTIME_TOKEN ?? "",
    BOOTSTRAP_RUNTIME_TOKEN: "",
  },
});

const shutdown = () => {
  runtime.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
runtime.on("exit", (code) => process.exit(code ?? 0));

await announcePairing();
