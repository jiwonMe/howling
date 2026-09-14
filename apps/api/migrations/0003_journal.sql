ALTER TABLE run_summaries ADD COLUMN run_mode TEXT NOT NULL DEFAULT 'live';

CREATE TABLE test_sessions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites (id),
  flow_id TEXT NOT NULL,
  run_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  artifact_json JSONB NOT NULL,
  fixtures_json JSONB NOT NULL,
  bundle_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE sync_journal (
  runtime_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  sync_seq BIGINT NOT NULL,
  run_id TEXT,
  item_json JSONB NOT NULL,
  tombstone BOOLEAN NOT NULL DEFAULT FALSE,
  acked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (runtime_id, stream, sync_seq)
);

CREATE TABLE sync_cursors (
  runtime_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  last_acked BIGINT NOT NULL DEFAULT 0,
  min_seq BIGINT NOT NULL DEFAULT 1,
  PRIMARY KEY (runtime_id, stream)
);
