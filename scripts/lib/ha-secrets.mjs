/**
 * 로컬 HA를 찾고 runtime secret(ha-url·ha-token)을 채운다. 토큰은 로그에 쓰지 않는다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { haOnboarded, onboardHa } from "./ha-onboard.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const secretPath = (root, name) => join(root, "secrets", name);

export const readSecret = (root, name) => {
  try {
    const value = readFileSync(secretPath(root, name), "utf8").trim();
    return value === "" ? undefined : value;
  } catch {
    return undefined;
  }
};

export const writeSecret = (root, name, value) => {
  const path = secretPath(root, name);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, value, { mode: 0o600 });
};

export const haAlive = async (url) => {
  try {
    const response = await fetch(`${url}/api/onboarding`);
    return response.ok;
  } catch {
    return false;
  }
};

export const waitForHa = async (url, attempts = 90) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await haAlive(url)) {
      return true;
    }
    await sleep(2000);
  }
  return false;
};

const tokenWorks = async (url, token) => {
  try {
    const response = await fetch(`${url}/api/`, {
      headers: { authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
};

const keep = async (root, url) => {
  const token = readSecret(root, "ha-token");
  if (!token || !(await tokenWorks(url, token))) {
    return false;
  }
  writeSecret(root, "ha-url", url);
  return true;
};

const copyFrom = async (source, target, url) => {
  const token = readSecret(source, "ha-token");
  if (!token || !(await tokenWorks(url, token))) {
    return false;
  }
  writeSecret(target, "ha-url", url);
  writeSecret(target, "ha-token", token);
  return true;
};

/**
 * 순서: env 토큰 → 이미 저장된 토큰 → 로컬 dev runtime 토큰 복사 → 새 HA 온보딩.
 * 어느 것도 안 되면 "manual"이고, 사람이 setup 화면에서 넣어야 한다.
 */
export const ensureHaSecrets = async (input) => {
  const { root, url, fallbackRoot, envToken } = input;
  if (envToken) {
    writeSecret(root, "ha-url", url);
    writeSecret(root, "ha-token", envToken);
    return "env";
  }
  if (await keep(root, url)) {
    return "keep";
  }
  if (fallbackRoot && (await copyFrom(fallbackRoot, root, url))) {
    return "copied";
  }
  if (await haOnboarded(url)) {
    return "manual";
  }
  try {
    const token = await onboardHa(url);
    writeSecret(root, "ha-url", url);
    writeSecret(root, "ha-token", token);
    return "onboarded";
  } catch {
    return "manual";
  }
};
