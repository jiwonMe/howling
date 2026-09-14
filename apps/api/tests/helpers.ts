/**
 * API integration 테스트 헬퍼.
 */
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import pg from "pg";
import { createOidcApp } from "../../../infra/oidc/src/app.js";
import { loadOidcConfig } from "../../../infra/oidc/src/config.js";
import { createApiApp } from "../src/app.js";
import { loadApiConfig } from "../src/config.js";
import { migratePostgres } from "../src/db/migrate.js";
import { seedBootstrap } from "../src/sites/provision.js";

export const databaseUrl =
  process.env.HOWLING_TEST_DATABASE_URL ??
  "postgres://howling:howling@127.0.0.1:5432/howling";

export const migrations = join(dirname(fileURLToPath(import.meta.url)), "../migrations");

export const pingPostgres = async (url: string): Promise<boolean> => {
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 800 });
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
};

export const freePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
};

export const postgresUp = await pingPostgres(databaseUrl);

export const startApi = async (env: NodeJS.ProcessEnv = {}) => {
  const port = await freePort();
  const issuer = `http://127.0.0.1:${String(port)}`;
  const redirectUri = "http://127.0.0.1:3000/api/v1/auth/callback";
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const oidc = await createOidcApp({
    ...loadOidcConfig(),
    issuer,
    listenHost: "127.0.0.1",
    listenPort: port,
    redirectUris: [redirectUri],
  });
  await oidc.listen({ host: "127.0.0.1", port });
  await migratePostgres(pool, migrations);
  const config = loadApiConfig({
    ...process.env,
    ...env,
    OIDC_ISSUER: issuer,
    OIDC_REDIRECT_URI: redirectUri,
    PUBLIC_ORIGIN: "http://127.0.0.1:3000",
  });
  await seedBootstrap(pool, config);
  const app = await createApiApp(config, pool);
  return { app, oidc, pool, config, redirectUri };
};

export const loginCookies = async (
  app: FastifyInstance,
  oidc: FastifyInstance,
): Promise<{ cookie: string; csrf: string }> => {
  const login = await app.inject({ method: "GET", url: "/api/v1/auth/login" });
  const authorizeUrl = new URL(login.headers.location ?? "");
  const issued = await oidc.inject({
    method: "POST",
    url: "/authorize",
    payload: {
      client_id: authorizeUrl.searchParams.get("client_id"),
      redirect_uri: authorizeUrl.searchParams.get("redirect_uri"),
      response_type: "code",
      scope: authorizeUrl.searchParams.get("scope"),
      state: authorizeUrl.searchParams.get("state"),
      nonce: authorizeUrl.searchParams.get("nonce"),
      code_challenge: authorizeUrl.searchParams.get("code_challenge"),
      email: "owner@howling.test",
      password: "howling-dev",
    },
  });
  const callback = new URL(issued.headers.location ?? "");
  const finished = await app.inject({
    method: "GET",
    url: `${callback.pathname}${callback.search}`,
  });
  const cookie = finished.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
  const csrf = finished.cookies.find((item) => item.name === "howling_csrf")?.value ?? "";
  return { cookie, csrf };
};

export const closeApi = async (input: {
  readonly app: FastifyInstance;
  readonly oidc: FastifyInstance;
  readonly pool: pg.Pool;
}) => {
  await input.app.close();
  await input.oidc.close();
  await input.pool.end();
};
