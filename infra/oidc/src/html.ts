/**
 * 테스트 계정 로그인 폼.
 */
export const loginPage = (input: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeChallenge: string;
  readonly scope: string;
  readonly error?: string;
}): string => {
  const error = input.error
    ? `<p role="alert">${escapeHtml(input.error)}</p>`
    : "";
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Howling 테스트 로그인</title>
  </head>
  <body>
    <h1>Howling 테스트 로그인</h1>
    ${error}
    <form method="post" action="/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(input.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(input.redirectUri)}" />
      <input type="hidden" name="state" value="${escapeHtml(input.state)}" />
      <input type="hidden" name="nonce" value="${escapeHtml(input.nonce)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(input.codeChallenge)}" />
      <input type="hidden" name="scope" value="${escapeHtml(input.scope)}" />
      <input type="hidden" name="response_type" value="code" />
      <label>이메일 <input name="email" type="email" autocomplete="username" /></label>
      <label>비밀번호 <input name="password" type="password" autocomplete="current-password" /></label>
      <button type="submit">로그인</button>
    </form>
  </body>
</html>`;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
