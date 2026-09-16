/**
 * OIDC discovery와 authorization code + PKCE.
 */
import * as client from "openid-client";
import type { ApiConfig } from "../config.js";

export interface OidcLoginStart {
  readonly authorizationUrl: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

export const discoverOidc = (
  config: ApiConfig,
): Promise<client.Configuration> =>
  client.discovery(
    new URL(config.oidcIssuer),
    config.oidcClientId,
    config.oidcClientSecret,
    undefined,
    {
      execute: [client.allowInsecureRequests],
    },
  );

export const startOidcLogin = async (
  oidc: client.Configuration,
  config: ApiConfig,
): Promise<OidcLoginStart> => {
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();
  const authorizationUrl = client
    .buildAuthorizationUrl(oidc, {
      redirect_uri: config.oidcRedirectUri,
      scope: "openid email",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    })
    .toString();
  return { authorizationUrl, state, nonce, codeVerifier };
};

export interface OidcIdentity {
  readonly subject: string;
  readonly email: string | null;
  /** Google 등은 email_verified를 준다. 없으면 null. */
  readonly emailVerified: boolean | null;
}

export const finishOidcLogin = async (
  oidc: client.Configuration,
  input: {
    readonly currentUrl: URL;
    readonly codeVerifier: string;
    readonly state: string;
    readonly nonce: string;
  },
): Promise<OidcIdentity> => {
  const tokens = await client.authorizationCodeGrant(oidc, input.currentUrl, {
    pkceCodeVerifier: input.codeVerifier,
    expectedState: input.state,
    expectedNonce: input.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub) {
    throw new Error("id_token missing sub");
  }
  return {
    subject: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    emailVerified:
      typeof claims.email_verified === "boolean" ? claims.email_verified : null,
  };
};
