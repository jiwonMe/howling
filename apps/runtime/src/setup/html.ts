/** 로컬 setup 페이지. */
export const setupHtml = (): string => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>Howling runtime setup</title>
<style>body{font-family:sans-serif;margin:2rem;max-width:32rem}label{display:block;margin:.5rem 0}</style>
</head><body>
<h1>Runtime setup</h1>
<p>HA 토큰은 이 장비에만 저장됩니다.</p>
<form id="ha">
<label>HA URL <input name="url" required></label>
<label>Long-lived token <input name="token" type="password" required></label>
<button type="submit">저장</button>
</form>
<button id="pair" type="button">Pairing 시작</button>
<pre id="out"></pre>
<script>
const out = document.getElementById("out");
const refresh = async () => {
  const status = await fetch("/v1/setup/status").then((r) => r.json());
  out.textContent = JSON.stringify(status, null, 2);
};
document.getElementById("ha").onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  await fetch("/v1/setup/ha", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  await refresh();
};
document.getElementById("pair").onclick = async () => {
  await fetch("/v1/setup/pair", { method: "POST" });
  await refresh();
};
refresh();
</script>
</body></html>`;
