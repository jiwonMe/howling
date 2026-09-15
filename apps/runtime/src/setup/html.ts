/**
 * 로컬 setup 페이지. pairing이 첫 할 일이다.
 */
import { setupPageCss } from "./page-css.js";
import { setupPageScript } from "./page-script.js";

export const setupHtml = (): string => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Howling runtime setup</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400..600&family=Geist+Mono:wght@400..600&family=Noto+Sans+KR:wght@400;500;600&display=swap" rel="stylesheet" referrerpolicy="no-referrer">
  <link href="/setup/vercel-brand.css" rel="stylesheet">
  <style>${setupPageCss}</style>
</head>
<body class="vbg-report vbg-custom-ko">
  <div class="vbg-shell">
    <a class="vbg-skip-link" href="#main">본문으로</a>
    <header class="vbg-header">
      <div class="vbg-masthead">
        <span class="vbg-identity"><span class="vbg-custom-wordmark">Howling</span></span>
        <div class="vbg-document-meta">
          <span class="vbg-context">이 장비</span>
        </div>
      </div>
    </header>
    <main id="main">
      <div class="vbg-opening">
        <h1 class="vbg-custom-title">이 장비를 Howling에 묶습니다</h1>
        <p class="vbg-custom-lede">연결 화면에 넣을 pairing code가 여기서 나옵니다. 허브 토큰은 이 장비에만 있습니다.</p>
      </div>
      <section class="vbg-section" aria-labelledby="pair-heading">
        <h2 class="vbg-custom-heading" id="pair-heading">Pairing code</h2>
        <p class="vbg-caption">Howling 웹의 연결에 코드를 넣으면 runtime이 site에 붙습니다.</p>
        <div class="vbg-stat-strip">
          <div class="vbg-stat">
            <p class="vbg-stat-label">허브</p>
            <p class="vbg-custom-value" id="hub-state">확인 중</p>
            <p class="vbg-stat-detail">토큰은 로컬 파일입니다.</p>
          </div>
          <div class="vbg-stat">
            <p class="vbg-stat-label">Pairing</p>
            <p class="vbg-custom-value" id="pair-state">확인 중</p>
            <p class="vbg-stat-detail">사람 코드만 화면에 있습니다.</p>
          </div>
        </div>
        <div class="vbg-calculator">
          <div class="vbg-calculator-output">
            <div class="vbg-result-group">
              <div class="vbg-result">
                <p class="vbg-result-label">지금 코드</p>
                <p class="vbg-result-value vbg-mono vbg-custom-code" id="pair-code" data-testid="pair-code">—</p>
                <p class="vbg-result-detail" id="pair-hint">연결에서 코드를 넣기 전에 여기서 시작합니다.</p>
              </div>
            </div>
          </div>
          <div class="vbg-calculator-inputs">
            <button class="vbg-button" id="pair" type="button">Pairing 시작</button>
          </div>
        </div>
      </section>
      <section class="vbg-section" aria-labelledby="hub-heading">
        <h2 class="vbg-custom-heading" id="hub-heading">허브</h2>
        <p class="vbg-caption">HA OS 앱은 자동입니다. Docker는 주소와 장기 토큰을 넣습니다.</p>
        <form class="vbg-calculator" id="ha">
          <div class="vbg-calculator-inputs">
            <div class="vbg-field">
              <label class="vbg-label" for="ha-url">허브 URL</label>
              <input id="ha-url" name="url" required autocomplete="url" placeholder="http://127.0.0.1:8123">
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="ha-token">Long-lived token</label>
              <input id="ha-token" name="token" type="password" required autocomplete="off">
              <p class="vbg-helper">허브 프로필에서 만든 장기 토큰입니다.</p>
            </div>
            <button class="vbg-button" type="submit">허브 저장</button>
          </div>
        </form>
      </section>
      <section class="vbg-section" aria-labelledby="mcp-heading">
        <h2 class="vbg-custom-heading" id="mcp-heading">MCP</h2>
        <p class="vbg-caption">로컬에서만 등록합니다. 클라우드로 command를 받지 않습니다.</p>
        <div class="vbg-table-wrap">
          <table>
            <caption>등록된 MCP</caption>
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">id</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody id="mcp-rows"></tbody>
          </table>
        </div>
        <p class="vbg-caption" id="mcp-empty">아직 없습니다.</p>
        <form class="vbg-calculator" id="mcp">
          <div class="vbg-calculator-inputs">
            <div class="vbg-control-group">
              <div class="vbg-field">
                <label class="vbg-label" for="mcp-id">id</label>
                <input id="mcp-id" name="id" value="echo" required class="vbg-mono">
              </div>
              <div class="vbg-field">
                <label class="vbg-label" for="mcp-name">이름</label>
                <input id="mcp-name" name="name" value="Echo" required>
              </div>
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="mcp-transport">transport</label>
              <select id="mcp-transport" name="transport">
                <option value="http">http</option>
                <option value="stdio">stdio</option>
              </select>
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="mcp-url">url</label>
              <input id="mcp-url" name="url" class="vbg-mono" placeholder="http://127.0.0.1:8091/mcp">
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="mcp-token">bearer token</label>
              <input id="mcp-token" name="token" type="password" autocomplete="off">
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="mcp-command">command</label>
              <input id="mcp-command" name="command" class="vbg-mono" placeholder="node">
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="mcp-args">args</label>
              <input id="mcp-args" name="args" class="vbg-mono" placeholder="server.js">
            </div>
            <button class="vbg-button" type="submit">MCP 저장</button>
          </div>
        </form>
      </section>
      <section class="vbg-section" aria-labelledby="oauth-heading">
        <h2 class="vbg-custom-heading-sm" id="oauth-heading">MCP OAuth</h2>
        <p class="vbg-caption">제공자를 고르고 이 장비에서 동의합니다. API는 authorization code를 저장하지 않습니다.</p>
        <form class="vbg-calculator" id="oauth">
          <div class="vbg-calculator-inputs">
            <div class="vbg-field">
              <label class="vbg-label" for="oauth-id">connection id</label>
              <input id="oauth-id" name="id" value="echo" required class="vbg-mono">
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="oauth-preset">제공자</label>
              <select id="oauth-preset" name="preset">
                <option value="custom">직접 입력</option>
                <option value="github">GitHub</option>
              </select>
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="oauth-authorize">authorize URL</label>
              <input id="oauth-authorize" name="authorizeUrl" class="vbg-mono">
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="oauth-token">token URL</label>
              <input id="oauth-token" name="tokenUrl" class="vbg-mono">
            </div>
            <div class="vbg-field">
              <label class="vbg-label" for="oauth-client">client id</label>
              <input id="oauth-client" name="clientId" required class="vbg-mono">
            </div>
            <button class="vbg-button" type="submit">동의 시작</button>
          </div>
        </form>
      </section>
      <section class="vbg-section">
        <details>
          <summary class="vbg-caption">상태 기록</summary>
          <div class="vbg-custom-audit"><pre class="vbg-mono" id="out"></pre></div>
        </details>
      </section>
    </main>
    <footer class="vbg-footer">
      <span class="vbg-custom-wordmark">Howling</span>
      <span>이 장비의 로컬 setup. 토큰은 여기에만 있습니다.</span>
    </footer>
  </div>
  <script>${setupPageScript}</script>
</body>
</html>`;
