PRAGMA foreign_keys = ON;

CREATE TABLE rfd_membership_v2 (
  rfd_id TEXT NOT NULL REFERENCES rfd_catalog(rfd_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'commenter')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (rfd_id, user_id)
) STRICT;

CREATE UNIQUE INDEX rfd_membership_v2_owner_idx
  ON rfd_membership_v2(rfd_id)
  WHERE role = 'owner';

INSERT INTO rfd_membership_v2 (rfd_id, user_id, role, created_at, updated_at)
SELECT rfd_id, owner_user_id, 'owner', created_at, updated_at
FROM rfd_catalog;

INSERT OR IGNORE INTO rfd_membership_v2 (rfd_id, user_id, role, created_at, updated_at)
SELECT legacy.rfd_id,
  legacy.user_id,
  CASE legacy.role
    WHEN 'reviewer' THEN 'commenter'
    ELSE 'editor'
  END,
  legacy.created_at,
  legacy.updated_at
FROM rfd_memberships legacy
JOIN rfd_catalog catalog ON catalog.rfd_id = legacy.rfd_id;
