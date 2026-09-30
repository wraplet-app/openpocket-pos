import type { Migration } from '../runner.ts';

/**
 * V0.6 — multiple shops on one device. `app_state` remembers which shop is
 * active; every existing query is already scoped by store_id, so switching the
 * current shop is all that's needed. Seeds the pointer with the existing shop
 * (if any) so upgrades keep working.
 */
const sql = /* sql */ `
CREATE TABLE app_state (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  current_store_id TEXT
);
INSERT INTO app_state (id, current_store_id) VALUES (1, (SELECT id FROM stores ORDER BY created_at LIMIT 1));
`;

export const migration: Migration = { id: '0007_shops', sql };
