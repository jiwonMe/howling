/**
 * 인가 코드와 access token을 메모리에 둔다.
 */
import { createHash, randomBytes } from "node:crypto";

export interface AuthCode {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly nonce: string;
  readonly subject: string;
  readonly email: string;
  readonly expiresAt: number;
}

export interface AccessToken {
  readonly token: string;
  readonly subject: string;
  readonly email: string;
  readonly expiresAt: number;
}

export interface OidcStore {
  saveCode: (entry: AuthCode) => void;
  takeCode: (code: string) => AuthCode | undefined;
  saveAccess: (entry: AccessToken) => void;
  readAccess: (token: string) => AccessToken | undefined;
}

export const hashVerifier = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

export const randomOpaque = (): string => randomBytes(32).toString("base64url");

export const createOidcStore = (): OidcStore => {
  const codes = new Map<string, AuthCode>();
  const tokens = new Map<string, AccessToken>();
  return {
    saveCode: (entry) => {
      codes.set(entry.code, entry);
    },
    takeCode: (code) => {
      const entry = codes.get(code);
      codes.delete(code);
      if (!entry || entry.expiresAt <= Date.now()) {
        return undefined;
      }
      return entry;
    },
    saveAccess: (entry) => {
      tokens.set(entry.token, entry);
    },
    readAccess: (token) => {
      const entry = tokens.get(token);
      if (!entry || entry.expiresAt <= Date.now()) {
        return undefined;
      }
      return entry;
    },
  };
};
