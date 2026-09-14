/**
 * 프로세스 수명 동안 쓰는 RS256 키.
 */
import { exportJWK, generateKeyPair, type CryptoKey, type JWK } from "jose";

export interface OidcKeys {
  readonly privateKey: CryptoKey;
  readonly jwk: JWK;
  readonly kid: string;
}

export const createOidcKeys = async (): Promise<OidcKeys> => {
  const kid = "howling-oidc-1";
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.use = "sig";
  jwk.alg = "RS256";
  return { privateKey, jwk, kid };
};
