/**
 * setup 페이지 동작. 기존 /v1/setup API를 그대로 쓴다.
 */
export const setupPageScript = `
const out = document.getElementById("out");
const pairCode = document.getElementById("pair-code");
const pairHint = document.getElementById("pair-hint");
const pairState = document.getElementById("pair-state");
const hubState = document.getElementById("hub-state");
const mcpBody = document.getElementById("mcp-rows");
const mcpEmpty = document.getElementById("mcp-empty");

const pairLabel = (status) => {
  if (status === "pending") return "코드 대기";
  if (status === "ready") return "묶임";
  if (status === "error") return "실패";
  if (status === "timeout") return "시간 초과";
  return "아직 안 묶음";
};

const pairHintOf = (pairing) => {
  if (pairing.status === "pending" && pairing.code) {
    return "Howling 연결 화면에 이 코드를 넣습니다.";
  }
  if (pairing.status === "ready") {
    return "이 장비는 site에 묶여 있습니다.";
  }
  if (pairing.status === "error") {
    return "다시 시작해 주세요.";
  }
  if (pairing.status === "timeout") {
    return "코드가 만료됐습니다. 다시 시작합니다.";
  }
  return "연결에서 코드를 넣기 전에 여기서 시작합니다.";
};

const fillMcp = (mcp) => {
  const servers = Array.isArray(mcp.servers) ? mcp.servers : [];
  mcpBody.replaceChildren();
  mcpEmpty.hidden = servers.length > 0;
  servers.forEach((item) => {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = item.name || item.id;
    const id = document.createElement("td");
    id.className = "vbg-mono";
    id.textContent = item.id;
    const status = document.createElement("td");
    status.textContent = item.status || "—";
    row.append(name, id, status);
    mcpBody.append(row);
  });
};

const refresh = async () => {
  const status = await fetch("/v1/setup/status").then((r) => r.json());
  const mcp = await fetch("/v1/setup/mcp").then((r) => r.json());
  const pairing = status.pairing || {};
  pairState.textContent = pairLabel(pairing.status);
  pairCode.textContent = pairing.code || "—";
  pairHint.textContent = pairHintOf(pairing);
  document.getElementById("pair").textContent =
    pairing.status === "ready" ? "다시 시작" : "Pairing 시작";
  hubState.textContent = status.haConfigured ? "저장됨" : "없음";
  fillMcp(mcp);
  out.textContent = JSON.stringify({ status, mcp }, null, 2);
};

document.getElementById("ha").onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  await fetch("/v1/setup/ha", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  await refresh();
};

document.getElementById("mcp").onsubmit = async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(event.target));
  const args = String(raw.args || "").trim();
  const body = {
    id: raw.id,
    name: raw.name,
    transport: raw.transport,
    auth: raw.token ? "bearer" : "none",
    ...(raw.url ? { url: raw.url } : {}),
    ...(raw.token ? { token: raw.token } : {}),
    ...(raw.command ? { command: raw.command } : {}),
    ...(args ? { args: args.split(/\\s+/) } : {}),
  };
  await fetch("/v1/setup/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  await refresh();
};

document.getElementById("oauth-preset").onchange = (event) => {
  const github = event.target.value === "github";
  document.getElementById("oauth-authorize").value = github
    ? "https://github.com/login/oauth/authorize"
    : "";
  document.getElementById("oauth-token").value = github
    ? "https://github.com/login/oauth/access_token"
    : "";
};

document.getElementById("oauth").onsubmit = async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(event.target));
  const started = await fetch("/v1/setup/mcp/" + raw.id + "/oauth/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      authorizeUrl: raw.authorizeUrl,
      tokenUrl: raw.tokenUrl,
      clientId: raw.clientId,
    }),
  }).then((r) => r.json());
  out.textContent = JSON.stringify(started, null, 2);
  if (started.authorizationUrl) window.location.assign(started.authorizationUrl);
};

document.getElementById("pair").onclick = async () => {
  await fetch("/v1/setup/pair", { method: "POST" });
  await refresh();
};

refresh();
setInterval(refresh, 4000);
`;
