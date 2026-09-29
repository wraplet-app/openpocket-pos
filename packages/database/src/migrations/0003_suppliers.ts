import type { Migration } from '../runner.ts';

/**
 * V0.3 — suppliers and purchases (restocking).
 *
 * Receiving a purchase writes purchases + purchase_items and a positive
 * 'purchase' stock movement per line, and updates products.cost_price to the
 * latest cost. Existing sale_items keep their own cost snapshot, so historical
 * profit never changes.
 */
const sql = /* sql */ `
CREATE TABLE suppliers (
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
CREATE INDEX idx_suppliers_store ON suppliers(store_id);
CREATE INDEX idx_suppliers_name ON suppliers(name);

CREATE TABLE purchases (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  supplier_id  TEXT REFERENCES suppliers(id),
  reference_no TEXT NOT NULL,
  total        INTEGER NOT NULL,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'received',
  purchased_at INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  device_id    TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  CHECK (status IN ('received','void')),
  UNIQUE (store_id, reference_no)
);
CREATE INDEX idx_purchases_store_time ON purchases(store_id, purchased_at);

CREATE TABLE purchase_items (
  id                    TEXT PRIMARY KEY,
  purchase_id           TEXT NOT NULL REFERENCES purchases(id),
  product_id            TEXT NOT NULL REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  unit_cost             INTEGER NOT NULL,
  quantity              INTEGER NOT NULL,
  line_total            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  device_id             TEXT NOT NULL,
  CHECK (quantity > 0)
);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);
`;

export const migration: Migration = { id: '0003_suppliers', sql };
