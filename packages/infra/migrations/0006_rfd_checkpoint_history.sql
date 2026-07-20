PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rfd_checkpoint_history (
  rfd_id TEXT NOT NULL REFERENCES rfd_catalog(rfd_id) ON DELETE CASCADE,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (rfd_id, sha)
) STRICT;

CREATE INDEX IF NOT EXISTS rfd_checkpoint_history_rfd_created_idx
  ON rfd_checkpoint_history(rfd_id, created_at DESC);
