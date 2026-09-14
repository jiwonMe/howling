/**
 * 테스트 전용 OIDC issuer 설정.
 */
export interface OidcConfig {
  readonly issuer: string;
  readonly listenHost: string;
  readonly listenPort: number;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUris: readonly string[];
  readonly testEmail: string;
  readonly testPassword: string;
  readonly testSubject: string;
}

const listen = (value: string): { host: string; port: number } => {
  const trimmed = value.trim();
  const lastColon = trimmed.lastIndexOf(":");
  const host = lastColon === -1 ? "127.0.0.1" : trimmed.slice(0, lastColon);
  const port = Number(lastColon === -1 ? "8081" : trimmed.slice(lastColon + 1));
  return { host, port };
};

export const loadOidcConfig = (
  env: NodeJS.ProcessEnv = process.env,
): OidcConfig => {
  const { host, port } = listen(env.OIDC_LISTEN ?? "127.0.0.1:8081");
  const redirect =
    env.OIDC_REDIRECT_URI ?? "http://127.0.0.1:5173/api/v1/auth/callback";
  const extra = env.OIDC_REDIRECT_URIS?.split(",").map((item) => item.trim()) ?? [];
  return {
    issuer: env.OIDC_ISSUER ?? `http://${host}:${String(port)}`,
    listenHost: host,
    listenPort: port,
    clientId: env.OIDC_CLIENT_ID ?? "howling-web",
    clientSecret: env.OIDC_CLIENT_SECRET ?? "howling-dev-secret",
    redirectUris: [...new Set([redirect, ...extra.filter(Boolean)])],
    testEmail: env.OIDC_TEST_EMAIL ?? "owner@howling.test",
    testPassword: env.OIDC_TEST_PASSWORD ?? "howling-dev",
    testSubject: env.OIDC_TEST_SUBJECT ?? "user_owner",
  };
};
