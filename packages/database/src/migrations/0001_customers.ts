import type { Migration } from '../runner.ts';

/**
 * V0.2 — customers and an auditable credit ledger.
 *
 * Customer balance is NEVER stored as a mutable number; it is derived as
 * SUM(customer_ledger.amount). Sign convention:
 *   + amount  → customer owes more (a credit sale charges the account)
 *   − amount  → customer owes less (a payment / refund reduces the balance)
 *
 * A fully-paid (cash/card/bank) sale writes NO ledger row — it only stamps
 * sales.customer_id for purchase history, so it leaves the balance unchanged.
 * Only credit sales, payments, refunds and adjustments touch the ledger.
 */
const sql = /* sql */ `
CREATE TABLE customers (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id),
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  device_id   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_customers_store ON customers(store_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE customer_ledger (
  id             TEXT PRIMARY KEY,
  store_id       TEXT NOT NULL REFERENCES stores(id),
  customer_id    TEXT NOT NULL REFERENCES customers(id),
  type           TEXT NOT NULL,
  amount         INTEGER NOT NULL,
  reference_type TEXT,
  reference_id   TEXT,
  note           TEXT,
  created_at     INTEGER NOT NULL,
  device_id      TEXT NOT NULL,
  CHECK (type IN ('sale','payment','refund','adjustment'))
);
CREATE INDEX idx_ledger_customer ON customer_ledger(customer_id);
CREATE INDEX idx_ledger_reference ON customer_ledger(reference_id);
`;

export const migration: Migration = { id: '0001_customers', sql };
