#!/usr/bin/env node
/**
 * API·runtime health/ready와 로그인 후 runtime online을 확인한다.
 */
const apiOrigin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:5173";
const runtimeOrigin = process.env.RUNTIME_ORIGIN ?? "http://127.0.0.1:4000";
const email = process.env.OIDC_TEST_EMAIL ?? "owner@howling.test";
const password = process.env.OIDC_TEST_PASSWORD ?? "howling-dev";

const jar = new Map();

const applyCookies = (response) => {
  const cookies = response.headers.getSetCookie?.() ?? [];
  for (const raw of cookies) {
    const pair = raw.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) {
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
};

const cookieHeader = () =>
  [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");

const request = async (url, init = {}) => {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const response = await fetch(url, {
    ...init,
    headers,
    redirect: "manual",
  });
  applyCookies(response);
  return response;
};

const expectOk = async (url, label) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} ${url} -> ${String(response.status)}`);
  }
  return response.json();
};

await expectOk(`${apiOrigin}/health`, "api health");
await expectOk(`${apiOrigin}/ready`, "api ready");
await expectOk(`${runtimeOrigin}/health`, "runtime health");
await expectOk(`${runtimeOrigin}/ready`, "runtime ready");

const login = await request(`${apiOrigin}/api/v1/auth/login`);
if (login.status !== 302) {
  throw new Error(`login start ${String(login.status)}`);
}
const authorizeUrl = login.headers.get("location");
if (!authorizeUrl) {
  throw new Error("login missing authorize location");
}

const authorize = new URL(authorizeUrl);
const form = new URLSearchParams({
  client_id: authorize.searchParams.get("client_id") ?? "",
  redirect_uri: authorize.searchParams.get("redirect_uri") ?? "",
  response_type: "code",
  scope: authorize.searchParams.get("scope") ?? "openid email",
  state: authorize.searchParams.get("state") ?? "",
  nonce: authorize.searchParams.get("nonce") ?? "",
  code_challenge: authorize.searchParams.get("code_challenge") ?? "",
  email,
  password,
});

const issued = await request(authorize.origin + authorize.pathname, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: form.toString(),
});
if (issued.status !== 302) {
  throw new Error(`authorize ${String(issued.status)}`);
}
const callbackUrl = issued.headers.get("location");
if (!callbackUrl) {
  throw new Error("authorize missing callback");
}

const callback = await request(callbackUrl);
if (callback.status !== 302) {
  throw new Error(`callback ${String(callback.status)} ${await callback.text()}`);
}

const me = await request(`${apiOrigin}/api/v1/auth/me`);
if (!me.ok) {
  throw new Error(`me ${String(me.status)}`);
}

const sites = await request(`${apiOrigin}/api/v1/sites`);
if (!sites.ok) {
  throw new Error(`sites ${String(sites.status)}`);
}
const list = await sites.json();
const site = list.sites[0];
if (!site) {
  throw new Error("no site after login");
}

const runtime = await request(`${apiOrigin}/api/v1/sites/${site.id}/runtime`);
if (!runtime.ok) {
  throw new Error(`runtime status ${String(runtime.status)}`);
}
const status = await runtime.json();
if (status.online !== true) {
  throw new Error(`runtime not online: ${JSON.stringify(status)}`);
}

console.log("phase0 health ok", {
  api: apiOrigin,
  runtimeId: status.runtimeId,
  online: status.online,
});
