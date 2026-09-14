CREATE TABLE users (
  id TEXT PRIMARY KEY,
  oidc_issuer TEXT NOT NULL,
  oidc_subject TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE oidc_login_states (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE memberships (
  site_id TEXT NOT NULL REFERENCES sites (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  role TEXT NOT NULL,
  PRIMARY KEY (site_id, user_id)
);

CREATE TABLE runtime_registrations (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites (id),
  runtime_id TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  connection_generation INTEGER NOT NULL DEFAULT 0,
  online BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  capabilities JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (site_id)
);
