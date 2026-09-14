#!/bin/sh
set -eu
CA_SRC="${HOWLING_CA:-/certs/ca.crt}"
if [ -f "$CA_SRC" ]; then
  cp "$CA_SRC" /usr/local/share/ca-certificates/howling-test.crt
  update-ca-certificates >/dev/null
  NSS_DIR="${HOME}/.pki/nssdb"
  mkdir -p "$NSS_DIR"
  if [ ! -f "$NSS_DIR/cert9.db" ]; then
    certutil -d "sql:${NSS_DIR}" -N --empty-password
  fi
  certutil -d "sql:${NSS_DIR}" -D -n howling-test >/dev/null 2>&1 || true
  certutil -d "sql:${NSS_DIR}" -A -t "C,," -n howling-test -i /usr/local/share/ca-certificates/howling-test.crt
fi
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
exec "$@"
