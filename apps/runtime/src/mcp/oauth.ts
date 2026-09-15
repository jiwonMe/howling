/**
 * Runtime이 state·PKCE를 만들고 token을 교환한다. code는 파일에 남기지 않는다.
 */
import { createHash, randomBytes } from "node:crypto";
import { readSecret, writeSecret } from "../secrets/store.js";
import { mcpOauthName, writeMcpToken } from "./secrets.js";

export type OauthPending = {
  readonly connectionId: string;
  readonly state: string;
  readonly verifier: string;
  readonly tokenUrl: string;
  readonly clientId: string;
};

export const startMcpOauth = (
  secretRoot: string,
  input: {
    readonly connectionId: string;
    readonly siteId: string;
    readonly authorizeUrl: string;
    readonly tokenUrl: string;
    readonly clientId: string;
    readonly redirectUri: string;
  },
): { readonly authorizationUrl: string; readonly state: string } => {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = `${input.siteId}.${randomBytes(16).toString("hex")}`;
  const pending: OauthPending = {
    connectionId: input.connectionId,
    state,
    verifier,
    tokenUrl: input.tokenUrl,
    clientId: input.clientId,
  };
  writeSecret(secretRoot, mcpOauthName(input.connectionId), JSON.stringify(pending));
  const url = new URL(input.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { authorizationUrl: url.toString(), state };
};

export const finishMcpOauth = async (
  secretRoot: string,
  connectionId: string,
  expectedState: string,
  code: string,
): Promise<boolean> => {
  const raw = readSecret(secretRoot, mcpOauthName(connectionId));
  if (!raw) {
    return false;
  }
  const pending = JSON.parse(raw) as OauthPending;
  if (pending.state !== expectedState) {
    return false;
  }
  const response = await fetch(pending.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: pending.clientId,
      code_verifier: pending.verifier,
    }),
  });
  if (!response.ok) {
    return false;
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    return false;
  }
  writeMcpToken(secretRoot, connectionId, body.access_token);
  writeSecret(secretRoot, mcpOauthName(connectionId), "");
  return true;
};

export const pendingOauthByState = (
  secretRoot: string,
  ids: readonly string[],
  state: string,
): OauthPending | undefined => {
  for (const id of ids) {
    const raw = readSecret(secretRoot, mcpOauthName(id));
    if (!raw) {
      continue;
    }
    const pending = JSON.parse(raw) as OauthPending;
    if (pending.state === state) {
      return pending;
    }
  }
  return undefined;
};
