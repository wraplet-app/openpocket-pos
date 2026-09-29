import type { Migration } from '../runner.ts';

/**
 * V0.1 schema. Money columns are INTEGER minor units. Booleans are INTEGER 0/1.
 * Timestamps are INTEGER epoch milliseconds. Every business table carries the
 * SyncFields (id, created_at, updated_at, device_id, version) so the future
 * sync module needs no restructuring.
 *
 * Foreign keys are declared here but only enforced when the connection runs
 * `PRAGMA foreign_keys = ON;` — the app sets that once at open time.
 *
 * Deviations from the spec, deliberate for V0.1 (see docs/roadmap.md):
 *  - products.tax_bps (integer basis points) instead of a tax_id → taxes table.
 *  - sales.customer_id is a nullable id with no FK yet; the customers table
 *    arrives in migration 0001 (V0.2). Walk-in sales leave it NULL.
 *  - quantities are integers; weighed/fractional units are a later migration.
 */
const sql = /* sql */ `
CREATE TABLE stores (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  currency_code     TEXT NOT NULL,
  currency_locale   TEXT NOT NULL,
  currency_decimals INTEGER NOT NULL DEFAULT 2,
  address           TEXT,
  phone             TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  device_id         TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id),
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  device_id   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_categories_store ON categories(store_id);

CREATE TABLE products (
  id                  TEXT PRIMARY KEY,
  store_id            TEXT NOT NULL REFERENCES stores(id),
  category_id         TEXT REFERENCES categories(id),
  name                TEXT NOT NULL,
  sku                 TEXT,
  barcode             TEXT,
  cost_price          INTEGER NOT NULL DEFAULT 0,
  selling_price       INTEGER NOT NULL,
  unit                TEXT NOT NULL DEFAULT 'unit',
  track_inventory     INTEGER NOT NULL DEFAULT 1,
  low_stock_threshold INTEGER,
  tax_bps             INTEGER NOT NULL DEFAULT 0,
  image_uri           TEXT,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  deleted_at          INTEGER,
  device_id           TEXT NOT NULL,
  version             INTEGER NOT NULL DEFAULT 1,
  CHECK (cost_price >= 0),
  CHECK (selling_price >= 0),
  CHECK (tax_bps >= 0)
);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);

CREATE TABLE sales (
  id             TEXT PRIMARY KEY,
  store_id       TEXT NOT NULL REFERENCES stores(id),
  invoice_no     TEXT NOT NULL,
  customer_id    TEXT,
  cashier_id     TEXT,
  status         TEXT NOT NULL DEFAULT 'completed',
  subtotal       INTEGER NOT NULL,
  discount_total INTEGER NOT NULL DEFAULT 0,
  tax_total      INTEGER NOT NULL DEFAULT 0,
  grand_total    INTEGER NOT NULL,
  note           TEXT,
  sold_at        INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  device_id      TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  CHECK (status IN ('completed','void')),
  UNIQUE (store_id, invoice_no)
);
CREATE INDEX idx_sales_store_time ON sales(store_id, sold_at);

CREATE TABLE sale_items (
  id                    TEXT PRIMARY KEY,
  sale_id               TEXT NOT NULL REFERENCES sales(id),
  product_id            TEXT,
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot          TEXT,
  unit_cost             INTEGER NOT NULL DEFAULT 0,
  unit_price            INTEGER NOT NULL,
  quantity              INTEGER NOT NULL,
  discount              INTEGER NOT NULL DEFAULT 0,
  tax                   INTEGER NOT NULL DEFAULT 0,
  line_total            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  device_id             TEXT NOT NULL,
  CHECK (quantity > 0),
  CHECK (unit_price >= 0)
);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

CREATE TABLE payments (
  id           TEXT PRIMARY KEY,
  sale_id      TEXT NOT NULL REFERENCES sales(id),
  type         TEXT NOT NULL,
  display_name TEXT,
  amount       INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  device_id    TEXT NOT NULL,
  CHECK (type IN ('cash','card','wallet','bank','credit','other'))
);
CREATE INDEX idx_payments_sale ON payments(sale_id);

CREATE TABLE stock_movements (
  id             TEXT PRIMARY KEY,
  store_id       TEXT NOT NULL REFERENCES stores(id),
  product_id     TEXT NOT NULL REFERENCES products(id),
  type           TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reference_type TEXT,
  reference_id   TEXT,
  note           TEXT,
  created_at     INTEGER NOT NULL,
  device_id      TEXT NOT NULL,
  CHECK (type IN (
    'opening_stock','sale','sale_return','purchase',
    'purchase_return','adjustment','damaged','transfer'
  ))
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_id);
`;

export const migration: Migration = { id: '0000_init', sql };
