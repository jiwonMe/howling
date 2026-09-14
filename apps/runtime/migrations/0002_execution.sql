CREATE TABLE revision_artifacts (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  digest TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE active_deployments (
  flow_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES revision_artifacts (id),
  generation INTEGER NOT NULL DEFAULT 1,
  state_epoch TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE trigger_inbox (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  input_json TEXT NOT NULL,
  mode TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL,
  run_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (flow_id, idempotency_key)
);

CREATE TABLE run_snapshots (
  run_id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL,
  progression_mode TEXT NOT NULL,
  holding INTEGER NOT NULL DEFAULT 0,
  state_epoch TEXT NOT NULL,
  last_event_seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE run_events (
  run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_json TEXT NOT NULL,
  PRIMARY KEY (run_id, sequence)
);

CREATE TABLE runtime_commands (
  command_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE effect_outbox (
  effect_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  intent_json TEXT NOT NULL,
  status TEXT NOT NULL,
  response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE node_states (
  flow_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  state_epoch TEXT NOT NULL,
  node_id TEXT NOT NULL,
  state_json TEXT NOT NULL,
  source_run_id TEXT NOT NULL,
  source_sequence INTEGER NOT NULL,
  PRIMARY KEY (flow_id, revision, state_epoch, node_id)
);

CREATE TABLE node_state_applies (
  run_id TEXT NOT NULL,
  event_sequence INTEGER NOT NULL,
  PRIMARY KEY (run_id, event_sequence)
);

CREATE TABLE pending_inbox (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
