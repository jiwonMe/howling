ALTER TABLE run_snapshots ADD COLUMN run_mode TEXT NOT NULL DEFAULT 'live';

CREATE TABLE test_sessions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  flow_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  fixtures_json TEXT NOT NULL,
  bundle_version TEXT NOT NULL,
  initial_state_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE summary_journal (
  stream TEXT NOT NULL,
  sync_seq INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  item_json TEXT NOT NULL,
  acked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (stream, sync_seq)
);
