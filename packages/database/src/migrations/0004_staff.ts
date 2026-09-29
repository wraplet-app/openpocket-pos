import type { Migration } from '../runner.ts';

/**
 * V0.4 — staff accounts, roles and PIN lock.
 *
 * Each staff member has a role (owner > manager > cashier) and a PIN stored as
 * a per-row salted hash (never plaintext). Sales record which staff rang them up
 * via sales.staff_id for accountability. Stores created before this migration
 * have zero staff; the app treats "no staff yet" as unlocked owner access until
 * the first staff member is added.
 */
const sql = /* sql */ `
CREATE TABLE staff (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'cashier',
  pin_salt    TEXT NOT NULL,
  pin_hash    TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  device_id   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  CHECK (role IN ('owner','manager','cashier'))
);
CREATE INDEX idx_staff_store ON staff(store_id);

ALTER TABLE sales ADD COLUMN staff_id TEXT REFERENCES staff(id);
`;

export const migration: Migration = { id: '0004_staff', sql };
