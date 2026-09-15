CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL,
  flow_id TEXT REFERENCES flow_drafts(id),
  created_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
