PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE TABLE oauth_accounts (
  provider TEXT NOT NULL CHECK (provider = 'github'),
  provider_account_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_login TEXT NOT NULL CHECK (length(trim(provider_login)) > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (provider, provider_account_id),
  UNIQUE (provider, user_id)
) STRICT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  rotated_at INTEGER,
  CHECK (expires_at > created_at),
  CHECK (rotated_at IS NULL OR rotated_at >= created_at)
) STRICT;

CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);

CREATE TABLE oauth_transactions (
  id_hash TEXT PRIMARY KEY NOT NULL CHECK (length(id_hash) = 64),
  state TEXT NOT NULL UNIQUE,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL CHECK (expires_at > created_at)
) STRICT;

CREATE INDEX oauth_transactions_expires_at ON oauth_transactions(expires_at);

CREATE TABLE workspace_settings (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewer_can_merge INTEGER NOT NULL DEFAULT 0 CHECK (reviewer_can_merge IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE TABLE rfd_memberships (
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(workspace_id) ON DELETE CASCADE,
  rfd_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('author', 'coauthor', 'reviewer')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (workspace_id, rfd_id, user_id)
) STRICT;

CREATE INDEX rfd_memberships_lookup ON rfd_memberships(workspace_id, rfd_id, role);

CREATE TRIGGER rfd_memberships_retain_author_delete
BEFORE DELETE ON rfd_memberships
WHEN OLD.role = 'author' AND NOT EXISTS (
  SELECT 1 FROM rfd_memberships
  WHERE workspace_id = OLD.workspace_id AND rfd_id = OLD.rfd_id
    AND role = 'author' AND user_id <> OLD.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'an RFD must retain at least one author');
END;

CREATE TRIGGER rfd_memberships_retain_author_update
BEFORE UPDATE OF role, workspace_id, rfd_id ON rfd_memberships
WHEN OLD.role = 'author'
  AND (NEW.role <> 'author' OR NEW.workspace_id <> OLD.workspace_id OR NEW.rfd_id <> OLD.rfd_id)
  AND NOT EXISTS (
    SELECT 1 FROM rfd_memberships
    WHERE workspace_id = OLD.workspace_id AND rfd_id = OLD.rfd_id
      AND role = 'author' AND user_id <> OLD.user_id
  )
BEGIN
  SELECT RAISE(ABORT, 'an RFD must retain at least one author');
END;
