/**
 * 처음 켠 HA를 온보딩하고 장기 토큰을 만든다. 토큰은 로그에 쓰지 않는다.
 */
const USERNAME = process.env.HA_USERNAME ?? "owner";
const PASSWORD = process.env.HA_PASSWORD ?? "howling-dev";

const clientIdOf = (url) => `${url}/`;

export const onboardingSteps = async (url) => {
  const response = await fetch(`${url}/api/onboarding`);
  if (!response.ok) {
    return [];
  }
  return (await response.json()) ?? [];
};

export const haOnboarded = async (url) => {
  const steps = await onboardingSteps(url);
  return steps.some((step) => step.step === "user" && step.done);
};

const exchangeToken = async (url, code) => {
  const response = await fetch(`${url}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientIdOf(url),
    }),
  });
  if (!response.ok) {
    throw new Error(`token exchange failed ${String(response.status)}`);
  }
  const body = await response.json();
  return body.access_token;
};

const completeSteps = async (url, access) => {
  const headers = {
    authorization: `Bearer ${access}`,
    "content-type": "application/json",
  };
  await fetch(`${url}/api/onboarding/core_config`, { method: "POST", headers, body: "{}" });
  await fetch(`${url}/api/onboarding/analytics`, { method: "POST", headers, body: "{}" });
  await fetch(`${url}/api/onboarding/integration`, {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: clientIdOf(url), redirect_uri: clientIdOf(url) }),
  });
};

const createUser = async (url) => {
  const response = await fetch(`${url}/api/onboarding/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientIdOf(url),
      name: "Owner",
      username: USERNAME,
      password: PASSWORD,
      language: "ko",
    }),
  });
  if (!response.ok) {
    throw new Error(`onboarding user ${String(response.status)}`);
  }
  const user = await response.json();
  return exchangeToken(url, user.auth_code);
};

/** Node 22+의 표준 WebSocket을 쓴다. ws 패키지는 루트에 없다. */
const createLongLivedToken = (url, access) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`${url.replace(/^http/, "ws")}/api/websocket`);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("long-lived token timeout"));
    }, 15_000);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === "auth_required") {
        socket.send(JSON.stringify({ type: "auth", access_token: access }));
        return;
      }
      if (message.type === "auth_ok") {
        socket.send(
          JSON.stringify({
            id: 1,
            type: "auth/long_lived_access_token",
            client_name: `howling-dev-${String(Date.now())}`,
            lifespan: 3650,
          }),
        );
        return;
      }
      if (message.type === "result") {
        clearTimeout(timer);
        socket.close();
        if (!message.success || typeof message.result !== "string") {
          reject(new Error("long-lived token rejected"));
          return;
        }
        resolve(message.result);
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("home assistant websocket failed"));
    });
  });

/** 온보딩이 끝나지 않은 HA에만 쓴다. 이미 계정이 있으면 던진다. */
export const onboardHa = async (url) => {
  const access = await createUser(url);
  await completeSteps(url, access);
  try {
    return await createLongLivedToken(url, access);
  } catch {
    return access;
  }
};
