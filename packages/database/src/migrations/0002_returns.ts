import type { Migration } from '../runner.ts';

/**
 * V0.3 — returns / refunds.
 *
 * A return NEVER edits or deletes the original sale. It is a separate,
 * auditable transaction that references the original via returns.sale_id and
 * return_items.sale_item_id. Processing a return also writes a positive
 * 'sale_return' stock movement (goods come back) and, for an "account" refund,
 * a negative customer_ledger 'refund' entry (reduces what the customer owes).
 * All amounts are positive minor units (they represent money going OUT).
 */
const sql = /* sql */ `
CREATE TABLE returns (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL REFERENCES stores(id),
  sale_id       TEXT NOT NULL REFERENCES sales(id),
  customer_id   TEXT,
  refund_method TEXT NOT NULL,
  subtotal      INTEGER NOT NULL,
  tax_total     INTEGER NOT NULL DEFAULT 0,
  grand_total   INTEGER NOT NULL,
  reason        TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  device_id     TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  CHECK (refund_method IN ('cash','card','bank','account'))
);
CREATE INDEX idx_returns_sale ON returns(sale_id);
CREATE INDEX idx_returns_store_time ON returns(store_id, created_at);

CREATE TABLE return_items (
  id                    TEXT PRIMARY KEY,
  return_id             TEXT NOT NULL REFERENCES returns(id),
  sale_item_id          TEXT NOT NULL REFERENCES sale_items(id),
  product_id            TEXT,
  product_name_snapshot TEXT NOT NULL,
  unit_cost             INTEGER NOT NULL DEFAULT 0,
  unit_price            INTEGER NOT NULL,
  quantity              INTEGER NOT NULL,
  tax                   INTEGER NOT NULL DEFAULT 0,
  line_total            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  device_id             TEXT NOT NULL,
  CHECK (quantity > 0)
);
CREATE INDEX idx_return_items_return ON return_items(return_id);
CREATE INDEX idx_return_items_saleitem ON return_items(sale_item_id);
`;

export const migration: Migration = { id: '0002_returns', sql };
