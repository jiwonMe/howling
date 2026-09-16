/**
 * API 프로세스 설정.
 */
export interface ApiConfig {
  readonly listenHost: string;
  readonly listenPort: number;
  readonly databaseUrl: string;
  readonly publicOrigin: string;
  readonly oidcIssuer: string;
  readonly oidcClientId: string;
  readonly oidcClientSecret: string;
  readonly oidcRedirectUri: string;
  readonly cookieSecure: boolean;
  readonly bootstrapSiteId: string;
  readonly bootstrapSiteName: string;
  readonly bootstrapRuntimeId: string;
  readonly bootstrapRuntimeToken: string;
  /** 웹 번들 경로. 배포에서만 채우고, 있으면 API가 SPA도 낸다. */
  readonly webDist: string | undefined;
}

export const loadApiConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ApiConfig => ({
  listenHost: env.API_HOST ?? "127.0.0.1",
  // Railway 등 PaaS는 PORT를 준다. API_PORT가 우선.
  listenPort: Number(env.API_PORT ?? env.PORT ?? "3000"),
  databaseUrl:
    env.DATABASE_URL ?? "postgres://howling:howling@127.0.0.1:5432/howling",
  publicOrigin: env.PUBLIC_ORIGIN ?? "http://127.0.0.1:5173",
  oidcIssuer: env.OIDC_ISSUER ?? "http://127.0.0.1:8081",
  oidcClientId: env.OIDC_CLIENT_ID ?? "howling-web",
  oidcClientSecret: env.OIDC_CLIENT_SECRET ?? "howling-dev-secret",
  oidcRedirectUri:
    env.OIDC_REDIRECT_URI ?? "http://127.0.0.1:5173/api/v1/auth/callback",
  cookieSecure: env.COOKIE_SECURE === "true",
  bootstrapSiteId: env.BOOTSTRAP_SITE_ID ?? "site_dev",
  bootstrapSiteName: env.BOOTSTRAP_SITE_NAME ?? "Dev Site",
  bootstrapRuntimeId: env.BOOTSTRAP_RUNTIME_ID ?? "runtime_dev",
  bootstrapRuntimeToken: env.BOOTSTRAP_RUNTIME_TOKEN ?? "dev-runtime-token",
  webDist: env.WEB_DIST || undefined,
});
