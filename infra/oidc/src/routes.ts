/**
 * OIDC discovery, authorize, token, userinfo.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { SignJWT } from "jose";
import type { OidcConfig } from "./config.js";
import { loginPage } from "./html.js";
import type { OidcKeys } from "./keys.js";
import {
  hashVerifier,
  randomOpaque,
  type OidcStore,
} from "./store.js";

interface AuthorizeQuery {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

interface AuthorizeBody extends AuthorizeQuery {
  email?: string;
  password?: string;
}

interface TokenBody {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  code_verifier?: string;
}

export const registerOidcRoutes = (
  app: FastifyInstance,
  config: OidcConfig,
  keys: OidcKeys,
  store: OidcStore,
): void => {
  app.get("/.well-known/openid-configuration", async () => ({
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/authorize`,
    token_endpoint: `${config.issuer}/token`,
    userinfo_endpoint: `${config.issuer}/userinfo`,
    jwks_uri: `${config.issuer}/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "email"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],
    code_challenge_methods_supported: ["S256"],
  }));

  app.get("/jwks", async () => ({ keys: [keys.jwk] }));

  app.get("/health", async () => ({ status: "ok", service: "oidc" }));

  app.get("/authorize", async (request, reply) => {
    const query = request.query as AuthorizeQuery;
    const error = validateAuthorize(config, query);
    if (error) {
      return reply.code(400).type("text/plain").send(error);
    }
    return reply.type("text/html").send(
      loginPage({
        clientId: query.client_id ?? "",
        redirectUri: query.redirect_uri ?? "",
        state: query.state ?? "",
        nonce: query.nonce ?? "",
        codeChallenge: query.code_challenge ?? "",
        scope: query.scope ?? "openid email",
      }),
    );
  });

  app.post("/authorize", async (request, reply) => {
    const body = request.body as AuthorizeBody;
    const error = validateAuthorize(config, body);
    if (error) {
      return reply.code(400).type("text/plain").send(error);
    }
    if (
      body.email !== config.testEmail ||
      body.password !== config.testPassword
    ) {
      return reply.type("text/html").send(
        loginPage({
          clientId: body.client_id ?? "",
          redirectUri: body.redirect_uri ?? "",
          state: body.state ?? "",
          nonce: body.nonce ?? "",
          codeChallenge: body.code_challenge ?? "",
          scope: body.scope ?? "openid email",
          error: "이메일 또는 비밀번호가 올바르지 않습니다.",
        }),
      );
    }
    const code = randomOpaque();
    store.saveCode({
      code,
      clientId: body.client_id ?? "",
      redirectUri: body.redirect_uri ?? "",
      codeChallenge: body.code_challenge ?? "",
      nonce: body.nonce ?? "",
      subject: config.testSubject,
      email: config.testEmail,
      expiresAt: Date.now() + 5 * 60_000,
    });
    const target = new URL(body.redirect_uri ?? "");
    target.searchParams.set("code", code);
    target.searchParams.set("state", body.state ?? "");
    return reply.redirect(target.toString());
  });

  app.post("/token", async (request, reply) => {
    const body = request.body as TokenBody;
    const client = readClient(config, request, body);
    if (!client.ok) {
      return reply.code(401).send({ error: "invalid_client" });
    }
    if (body.grant_type !== "authorization_code") {
      return reply.code(400).send({ error: "unsupported_grant_type" });
    }
    const entry = body.code ? store.takeCode(body.code) : undefined;
    if (
      !entry ||
      entry.clientId !== client.id ||
      entry.redirectUri !== body.redirect_uri
    ) {
      return reply.code(400).send({ error: "invalid_grant" });
    }
    if (!body.code_verifier || hashVerifier(body.code_verifier) !== entry.codeChallenge) {
      return reply.code(400).send({ error: "invalid_grant" });
    }
    const access = randomOpaque();
    store.saveAccess({
      token: access,
      subject: entry.subject,
      email: entry.email,
      expiresAt: Date.now() + 60 * 60_000,
    });
    const idToken = await new SignJWT({
      nonce: entry.nonce,
      email: entry.email,
      email_verified: true,
    })
      .setProtectedHeader({ alg: "RS256", kid: keys.kid })
      .setIssuer(config.issuer)
      .setAudience(config.clientId)
      .setSubject(entry.subject)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);
    return {
      access_token: access,
      token_type: "Bearer",
      expires_in: 3600,
      id_token: idToken,
    };
  });

  app.get("/userinfo", async (request, reply) => {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const entry = store.readAccess(token);
    if (!entry) {
      return reply.code(401).send({ error: "invalid_token" });
    }
    return {
      sub: entry.subject,
      email: entry.email,
      email_verified: true,
    };
  });
};

const validateAuthorize = (
  config: OidcConfig,
  input: AuthorizeQuery,
): string | undefined => {
  if (input.client_id !== config.clientId) {
    return "unknown client";
  }
  if (!input.redirect_uri || !config.redirectUris.includes(input.redirect_uri)) {
    return "invalid redirect_uri";
  }
  if (input.response_type !== "code") {
    return "unsupported response_type";
  }
  if (input.code_challenge_method && input.code_challenge_method !== "S256") {
    return "code_challenge_method must be S256";
  }
  if (!input.code_challenge || !input.state || !input.nonce) {
    return "state, nonce, and code_challenge are required";
  }
  return undefined;
};

const readClient = (
  config: OidcConfig,
  request: FastifyRequest,
  body: TokenBody,
): { ok: true; id: string } | { ok: false } => {
  const header = request.headers.authorization ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const split = decoded.indexOf(":");
    const id = decoded.slice(0, split);
    const secret = decoded.slice(split + 1);
    if (id === config.clientId && secret === config.clientSecret) {
      return { ok: true, id };
    }
    return { ok: false };
  }
  if (
    body.client_id === config.clientId &&
    body.client_secret === config.clientSecret
  ) {
    return { ok: true, id: body.client_id };
  }
  return { ok: false };
};
