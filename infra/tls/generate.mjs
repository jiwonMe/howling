#!/usr/bin/env node
/**
 * E2E 전용 테스트 CA와 leaf 인증서를 만든다. 호스트 trust store는 건드리지 않는다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "generated");
mkdirSync(out, { recursive: true });

const openssl = (args) => execFileSync("openssl", args, { stdio: "inherit" });

const caCnf = join(out, "ca.cnf");
writeFileSync(
  caCnf,
  `[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
CN = Howling Test CA

[v3_ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
`,
);

openssl([
  "req",
  "-x509",
  "-newkey",
  "rsa:2048",
  "-sha256",
  "-days",
  "3650",
  "-nodes",
  "-keyout",
  join(out, "ca.key"),
  "-out",
  join(out, "ca.crt"),
  "-config",
  caCnf,
]);

const leafCnf = join(out, "leaf.cnf");
writeFileSync(
  leafCnf,
  `[req]
distinguished_name = dn
prompt = no

[dn]
CN = howling.test

[v3_leaf]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:howling.test,DNS:auth.howling.test,DNS:*.howling.test
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
`,
);

openssl([
  "req",
  "-new",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  join(out, "howling.test.key"),
  "-out",
  join(out, "howling.test.csr"),
  "-config",
  leafCnf,
]);

openssl([
  "x509",
  "-req",
  "-in",
  join(out, "howling.test.csr"),
  "-CA",
  join(out, "ca.crt"),
  "-CAkey",
  join(out, "ca.key"),
  "-CAcreateserial",
  "-out",
  join(out, "howling.test.crt"),
  "-days",
  "825",
  "-sha256",
  "-extfile",
  leafCnf,
  "-extensions",
  "v3_leaf",
]);

console.log(`wrote certificates to ${out}`);
