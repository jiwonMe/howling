/**
 * 로컬 runtime 설정.
 */
export interface RuntimeConfig {
  readonly listenHost: string;
  readonly listenPort: number;
  readonly sqlitePath: string;
  readonly secretRoot: string;
  readonly runtimeId: string;
  readonly siteId: string;
  readonly apiUrl: string;
  readonly apiHttpUrl: string;
  readonly token: string;
  readonly tokenFile: string | undefined;
  readonly testHooks: boolean;
  onCredential?: (token: string) => void;
}

export const loadRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig => ({
  listenHost: env.RUNTIME_HOST ?? "127.0.0.1",
  listenPort: Number(env.RUNTIME_PORT ?? "4000"),
  sqlitePath: env.RUNTIME_SQLITE_PATH ?? "data/runtime.sqlite",
  secretRoot: env.RUNTIME_SECRET_ROOT ?? "data",
  runtimeId: env.RUNTIME_ID ?? "runtime_dev",
  siteId: env.RUNTIME_SITE_ID ?? "site_dev",
  apiUrl: env.RUNTIME_API_URL ?? "ws://127.0.0.1:3000/api/v1/runtime/ws",
  apiHttpUrl:
    env.RUNTIME_API_HTTP ??
    (env.RUNTIME_API_URL ?? "ws://127.0.0.1:3000/api/v1/runtime/ws")
      .replace(/^ws/, "http")
      .replace(/\/api\/v1\/runtime\/ws$/, ""),
  token: env.RUNTIME_TOKEN ?? env.BOOTSTRAP_RUNTIME_TOKEN ?? "dev-runtime-token",
  tokenFile: env.RUNTIME_TOKEN_FILE,
  testHooks: env.RUNTIME_TEST_HOOKS === "1",
});
