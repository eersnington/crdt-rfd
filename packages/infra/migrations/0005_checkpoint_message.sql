ALTER TABLE rfd_catalog ADD COLUMN checkpoint_message TEXT;

CREATE INDEX rfd_catalog_forked_from_idx ON rfd_catalog(forked_from_rfd_id);
