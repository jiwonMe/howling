CREATE TABLE site_data_policies (
  site_id TEXT PRIMARY KEY REFERENCES sites (id),
  policy_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE observation_specs (
  site_id TEXT PRIMARY KEY REFERENCES sites (id),
  spec_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE observe_samples (
  site_id TEXT NOT NULL REFERENCES sites (id),
  field_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  kind TEXT NOT NULL,
  run_id TEXT,
  node_id TEXT,
  PRIMARY KEY (site_id, field_id, ts)
);

CREATE TABLE detail_audits (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites (id),
  run_id TEXT NOT NULL,
  node_id TEXT,
  field TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
