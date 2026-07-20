PRAGMA foreign_keys = ON;

CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL CHECK (email_verified IN (0, 1)),
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE session (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX session_user_id_idx ON session(user_id);

CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (provider_id, account_id)
) STRICT;

CREATE INDEX account_user_id_idx ON account(user_id);

CREATE TABLE verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX verification_identifier_idx ON verification(identifier);

CREATE TABLE workspace_settings (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  reviewer_can_merge INTEGER NOT NULL DEFAULT 0 CHECK (reviewer_can_merge IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
) STRICT;

CREATE TABLE rfd_memberships (
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(workspace_id) ON DELETE CASCADE,
  rfd_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('author', 'coauthor', 'reviewer')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (workspace_id, rfd_id, user_id)
) STRICT;

CREATE INDEX rfd_memberships_lookup ON rfd_memberships(workspace_id, rfd_id, role);

CREATE TRIGGER rfd_memberships_require_initial_author
BEFORE INSERT ON rfd_memberships
WHEN NEW.role <> 'author' AND NOT EXISTS (
  SELECT 1 FROM rfd_memberships
  WHERE workspace_id = NEW.workspace_id AND rfd_id = NEW.rfd_id
)
BEGIN
  SELECT RAISE(ABORT, 'the first RFD membership must be an author');
END;

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

CREATE TRIGGER rfd_memberships_require_author_at_update_destination
BEFORE UPDATE OF workspace_id, rfd_id ON rfd_memberships
WHEN NEW.role <> 'author'
  AND (NEW.workspace_id <> OLD.workspace_id OR NEW.rfd_id <> OLD.rfd_id)
  AND NOT EXISTS (
    SELECT 1 FROM rfd_memberships
    WHERE workspace_id = NEW.workspace_id AND rfd_id = NEW.rfd_id AND role = 'author'
  )
BEGIN
  SELECT RAISE(ABORT, 'an RFD membership cannot move to an RFD without an author');
END;
