import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOidcApp } from "../src/app.js";
import { loadOidcConfig } from "../src/config.js";

const verifier = "test-code-verifier-0123456789abcdef";
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe("oidc-test issuer", () => {
  it("serves discovery and completes a code+PKCE login", async () => {
    const config = loadOidcConfig({
      OIDC_LISTEN: "127.0.0.1:0",
      OIDC_ISSUER: "http://127.0.0.1:0",
      OIDC_REDIRECT_URI: "http://127.0.0.1:5173/api/v1/auth/callback",
    });
    const app = await createOidcApp({
      ...config,
      issuer: "http://issuer.test",
    });

    const discovery = await app.inject({
      method: "GET",
      url: "/.well-known/openid-configuration",
    });
    expect(discovery.statusCode).toBe(200);
    expect(discovery.json().authorization_endpoint).toBe(
      "http://issuer.test/authorize",
    );

    const authorize = await app.inject({
      method: "POST",
      url: "/authorize",
      payload: {
        client_id: config.clientId,
        redirect_uri: config.redirectUris[0],
        response_type: "code",
        scope: "openid email",
        state: "state-1",
        nonce: "nonce-1",
        code_challenge: challenge,
        email: config.testEmail,
        password: config.testPassword,
      },
    });
    expect(authorize.statusCode).toBe(302);
    const location = new URL(authorize.headers.location ?? "");
    const code = location.searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await app.inject({
      method: "POST",
      url: "/token",
      payload: {
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUris[0],
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: verifier,
      },
    });
    expect(token.statusCode).toBe(200);
    const body = token.json() as { access_token: string; id_token: string };
    expect(body.id_token.length).toBeGreaterThan(10);

    const userinfo = await app.inject({
      method: "GET",
      url: "/userinfo",
      headers: { authorization: `Bearer ${body.access_token}` },
    });
    expect(userinfo.json()).toMatchObject({
      sub: config.testSubject,
      email: config.testEmail,
    });
    await app.close();
  });
});
