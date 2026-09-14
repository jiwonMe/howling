ALTER TABLE revision_artifacts ADD COLUMN triggers_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE revision_artifacts ADD COLUMN connections_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE connection_configs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
