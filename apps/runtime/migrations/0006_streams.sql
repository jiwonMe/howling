ALTER TABLE summary_journal ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revision_artifacts ADD COLUMN execution_policy_json TEXT NOT NULL DEFAULT '{"mode":"live","captureRaw":false}';

CREATE TABLE IF NOT EXISTS local_data_policy (
  id TEXT PRIMARY KEY,
  policy_json TEXT NOT NULL,
  capture_raw INTEGER NOT NULL DEFAULT 0,
  raw_enabled_at TEXT,
  observations_json TEXT NOT NULL DEFAULT '{"fields":[]}'
);

CREATE TABLE IF NOT EXISTS observation_samples (
  field_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  value REAL NOT NULL,
  kind TEXT NOT NULL,
  run_id TEXT,
  node_id TEXT,
  PRIMARY KEY (field_id, ts)
);

CREATE TABLE IF NOT EXISTS observer_progress (
  run_id TEXT PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
);
