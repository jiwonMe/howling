CREATE TABLE runtime_pairings (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  runtime_secret_hash TEXT NOT NULL,
  runtime_id TEXT,
  site_id TEXT REFERENCES sites (id),
  token_hash TEXT,
  issued_token TEXT,
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE flow_drafts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites (id),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  definition_json JSONB NOT NULL,
  triggers_json JSONB NOT NULL,
  connections_json JSONB NOT NULL,
  execution_policy_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE editor_documents (
  flow_id TEXT PRIMARY KEY REFERENCES flow_drafts (id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  positions_json JSONB NOT NULL,
  groups_json JSONB NOT NULL,
  viewport_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE flow_revisions (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flow_drafts (id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites (id),
  artifact_json JSONB NOT NULL,
  digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flow_drafts (id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites (id),
  revision_id TEXT NOT NULL REFERENCES flow_revisions (id),
  generation INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (site_id, flow_id, generation)
);

CREATE TABLE run_summaries (
  run_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites (id),
  flow_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_seq INTEGER NOT NULL,
  trigger_json JSONB,
  events_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE flow_idempotency (
  site_id TEXT NOT NULL,
  key TEXT NOT NULL,
  kind TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (site_id, key)
);
