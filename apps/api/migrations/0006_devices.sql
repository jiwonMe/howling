CREATE TABLE IF NOT EXISTS site_devices (
  site_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  actions_json JSONB NOT NULL,
  numeric BOOLEAN NOT NULL,
  available BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (site_id, id)
);
