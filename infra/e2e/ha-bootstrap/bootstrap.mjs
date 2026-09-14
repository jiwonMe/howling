/**
 * HA onboarding + helper 확인 + 로컬 제어 HTTP.
 * 토큰은 로그에 쓰지 않는다.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import WebSocket from "ws";

const HA = process.env.HA_URL ?? "http://home-assistant:8123";
const CLIENT_ID = "http://home-assistant:8123/";
const SECRET_DIR = process.env.SECRET_DIR ?? "/secrets";
const RUNTIME_HOOKS = process.env.RUNTIME_HOOKS ?? "http://runtime:4000/v1/test/hooks";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitOnboarding = async () => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(`${HA}/api/onboarding`);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // 기동 전.
    }
    await sleep(2000);
  }
  throw new Error("home assistant onboarding is not ready");
};

const exchangeToken = async (code) => {
  const response = await fetch(`${HA}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
    }),
  });
  if (!response.ok) {
    throw new Error(`token exchange failed ${String(response.status)}`);
  }
  const body = await response.json();
  return body.access_token;
};

const completeSteps = async (access) => {
  const headers = {
    authorization: `Bearer ${access}`,
    "content-type": "application/json",
  };
  await fetch(`${HA}/api/onboarding/core_config`, {
    method: "POST",
    headers,
    body: "{}",
  });
  await fetch(`${HA}/api/onboarding/analytics`, {
    method: "POST",
    headers,
    body: "{}",
  });
  await fetch(`${HA}/api/onboarding/integration`, {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: CLIENT_ID, redirect_uri: CLIENT_ID }),
  });
};

const createLongLivedToken = (access) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`${HA.replace(/^http/, "ws")}/api/websocket`);
    let nextId = 1;
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: access }));
        return;
      }
      if (message.type === "auth_ok") {
        ws.send(
          JSON.stringify({
            id: nextId,
            type: "auth/long_lived_access_token",
            client_name: "howling-e2e",
            lifespan: 3650,
          }),
        );
        nextId += 1;
        return;
      }
      if (message.type === "result") {
        ws.close();
        if (!message.success || typeof message.result !== "string") {
          reject(new Error("long-lived token failed"));
          return;
        }
        resolve(message.result);
      }
    });
    ws.on("error", reject);
  });

const verifyHelpers = async (access) => {
  const headers = { authorization: `Bearer ${access}` };
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const power = await fetch(`${HA}/api/states/input_number.test_power`, { headers });
    const alert = await fetch(`${HA}/api/states/input_boolean.test_alert`, { headers });
    if (power.ok && alert.ok) {
      const powerBody = await power.json();
      const alertBody = await alert.json();
      if (powerBody.state === "0.0" || powerBody.state === "0") {
        if (alertBody.state === "off") {
          return;
        }
      }
    }
    await sleep(1000);
  }
  throw new Error("helpers are not ready");
};

const setPower = async (access, value) => {
  const response = await fetch(`${HA}/api/services/input_number/set_value`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${access}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ entity_id: "input_number.test_power", value }),
  });
  if (!response.ok) {
    throw new Error(`set_value ${String(response.status)}`);
  }
};

const readAlert = async (access) => {
  const response = await fetch(`${HA}/api/states/input_boolean.test_alert`, {
    headers: { authorization: `Bearer ${access}` },
  });
  const body = await response.json();
  return body.state;
};

const loginExisting = async () => {
  const started = await fetch(`${HA}/auth/login_flow`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      handler: ["homeassistant", null],
      redirect_uri: CLIENT_ID,
    }),
  });
  if (!started.ok) {
    throw new Error(`login flow ${String(started.status)}`);
  }
  const flow = await started.json();
  const finished = await fetch(`${HA}/auth/login_flow/${flow.flow_id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      username: "owner",
      password: "howling-dev",
    }),
  });
  if (!finished.ok) {
    throw new Error(`login finish ${String(finished.status)}`);
  }
  const result = await finished.json();
  const code = result.result;
  if (typeof code !== "string") {
    throw new Error("login did not return an auth code");
  }
  return exchangeToken(code);
};

const onboardOrLogin = async () => {
  await waitOnboarding();
  const created = await fetch(`${HA}/api/onboarding/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      name: "Owner",
      username: "owner",
      password: "howling-dev",
      language: "en",
    }),
  });
  if (created.ok) {
    const user = await created.json();
    const token = await exchangeToken(user.auth_code);
    await completeSteps(token);
    return token;
  }
  if (created.status === 403 || created.status === 400) {
    return loginExisting();
  }
  throw new Error(`onboarding user ${String(created.status)}`);
};

const reuseExisting = async () => {
  const path = `${SECRET_DIR}/ha-token`;
  if (!existsSync(path)) {
    return undefined;
  }
  const token = readFileSync(path, "utf8").trim();
  if (!token) {
    return undefined;
  }
  try {
    await verifyHelpers(token);
    return token;
  } catch {
    return undefined;
  }
};

const persistSecrets = (token) => {
  writeFileSync(`${SECRET_DIR}/ha-url`, HA, { mode: 0o600 });
  writeFileSync(`${SECRET_DIR}/ha-token`, token, { mode: 0o600 });
};

const access = await (async () => {
  const existing = await reuseExisting();
  if (existing) {
    persistSecrets(existing);
    return existing;
  }
  const token = await onboardOrLogin();
  let llat = token;
  try {
    llat = await createLongLivedToken(token);
  } catch {
    llat = token;
  }
  await verifyHelpers(llat);
  persistSecrets(llat);
  return llat;
})();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://ha-control");
  try {
    if (url.pathname === "/ready") {
      response.writeHead(200).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === "/set-power" && request.method === "POST") {
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      await setPower(access, body.value);
      response.writeHead(200).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === "/alert") {
      const state = await readAlert(access);
      response.writeHead(200).end(JSON.stringify({ state }));
      return;
    }
    if (url.pathname === "/runtime-hooks") {
      const hooks = await fetch(RUNTIME_HOOKS);
      response.writeHead(hooks.status).end(await hooks.text());
      return;
    }
    response.writeHead(404).end();
  } catch {
    response.writeHead(500).end(JSON.stringify({ error: "ha-control failed" }));
  }
});

server.listen(8090, "0.0.0.0");
