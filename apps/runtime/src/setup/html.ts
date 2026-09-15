/** 로컬 setup 페이지. */
export const setupHtml = (): string => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>Howling runtime setup</title>
<style>body{font-family:sans-serif;margin:2rem;max-width:36rem}label{display:block;margin:.5rem 0}fieldset{margin:1.5rem 0;border:1px solid #ccc}</style>
</head><body>
<h1>Runtime setup</h1>
<p>HA·MCP 토큰은 이 장비에만 저장됩니다. Cloud는 stdio command를 받지 않습니다.</p>
<form id="ha">
<label>HA URL <input name="url" required></label>
<label>Long-lived token <input name="token" type="password" required></label>
<button type="submit">HA 저장</button>
</form>
<fieldset>
<legend>MCP</legend>
<form id="mcp">
<label>id <input name="id" value="echo" required></label>
<label>name <input name="name" value="Echo" required></label>
<label>transport
  <select name="transport">
    <option value="http">http</option>
    <option value="stdio">stdio</option>
  </select>
</label>
<label>url <input name="url" placeholder="http://127.0.0.1:8091/mcp"></label>
<label>bearer token <input name="token" type="password"></label>
<label>command <input name="command" placeholder="node"></label>
<label>args <input name="args" placeholder="server.js"></label>
<button type="submit">MCP 저장</button>
</form>
</fieldset>
<fieldset>
<legend>MCP OAuth</legend>
<form id="oauth">
<label>connection id <input name="id" value="echo" required></label>
<label>제공자
  <select name="preset" id="oauth-preset">
    <option value="custom">직접 입력</option>
    <option value="github">GitHub</option>
  </select>
</label>
<label>authorize URL <input name="authorizeUrl" id="oauth-authorize"></label>
<label>token URL <input name="tokenUrl" id="oauth-token"></label>
<label>client id <input name="clientId" required></label>
<button type="submit">동의 시작</button>
</form>
</fieldset>
<button id="pair" type="button">Pairing 시작</button>
<pre id="out"></pre>
<script>
const out = document.getElementById("out");
const refresh = async () => {
  const status = await fetch("/v1/setup/status").then((r) => r.json());
  const mcp = await fetch("/v1/setup/mcp").then((r) => r.json());
  out.textContent = JSON.stringify({ status, mcp }, null, 2);
};
document.getElementById("ha").onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  await fetch("/v1/setup/ha", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  await refresh();
};
document.getElementById("mcp").onsubmit = async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(event.target));
  const args = String(raw.args || "").trim();
  const body = {
    id: raw.id, name: raw.name, transport: raw.transport, auth: raw.token ? "bearer" : "none",
    ...(raw.url ? { url: raw.url } : {}),
    ...(raw.token ? { token: raw.token } : {}),
    ...(raw.command ? { command: raw.command } : {}),
    ...(args ? { args: args.split(/\\s+/) } : {}),
  };
  await fetch("/v1/setup/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await refresh();
};
document.getElementById("oauth-preset").onchange = (event) => {
  const github = event.target.value === "github";
  document.getElementById("oauth-authorize").value = github ? "https://github.com/login/oauth/authorize" : "";
  document.getElementById("oauth-token").value = github ? "https://github.com/login/oauth/access_token" : "";
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
</script>
</body></html>`;
