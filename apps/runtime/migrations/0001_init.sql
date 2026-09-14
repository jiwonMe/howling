CREATE TABLE runtime_identity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  runtime_id TEXT NOT NULL,
  site_id TEXT,
  api_url TEXT NOT NULL
);
