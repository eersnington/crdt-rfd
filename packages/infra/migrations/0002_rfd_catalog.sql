PRAGMA foreign_keys = ON;

CREATE TABLE rfd_catalog (
  rfd_id TEXT PRIMARY KEY NOT NULL,
  number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'discussion', 'accepted', 'rejected', 'superseded')),
  artifact_repo_name TEXT NOT NULL UNIQUE,
  artifact_remote TEXT NOT NULL,
  head_sha TEXT,
  comment_policy TEXT NOT NULL DEFAULT 'anyone'
    CHECK (comment_policy IN ('anyone', 'members')),
  forked_from_rfd_id TEXT REFERENCES rfd_catalog(rfd_id) ON DELETE SET NULL,
  forked_from_sha TEXT,
  owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE INDEX rfd_catalog_updated_at_idx ON rfd_catalog(updated_at DESC);

CREATE TABLE rfd_number_sequence (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  next_number INTEGER NOT NULL CHECK (next_number > 0)
) STRICT;

INSERT INTO rfd_number_sequence (singleton, next_number) VALUES (1, 1);
