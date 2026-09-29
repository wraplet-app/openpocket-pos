import type { Migration } from '../runner.ts';

/**
 * V0.5 — local sync state. Device-only: holds the cloud server URL, the store
 * token, and the push/pull cursors. Never synced itself (not in SYNC_TABLES).
 */
const sql = /* sql */ `
CREATE TABLE sync_state (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  server_url     TEXT,
  token          TEXT,
  last_pushed_at INTEGER NOT NULL DEFAULT 0,
  last_pulled_at INTEGER NOT NULL DEFAULT 0,
  last_synced_at INTEGER
);
INSERT INTO sync_state (id) VALUES (1);
`;

export const migration: Migration = { id: '0005_sync', sql };
