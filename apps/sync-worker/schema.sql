-- OpenPocket cloud mirror (Cloudflare D1 = SQLite). Mirrors the on-device
-- schema so rows sync 1:1. Multi-store: every row is scoped by store_id (or by
-- its parent). Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS sync_tokens (
  token      TEXT PRIMARY KEY,
  store_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_tokens_store ON sync_tokens(store_id);

CREATE TABLE IF NOT EXISTS stores (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  currency_code     TEXT NOT NULL,
  currency_locale   TEXT NOT NULL,
  currency_decimals INTEGER NOT NULL DEFAULT 2,
  address           TEXT,
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  tax_id            TEXT,
  tagline           TEXT,
  receipt_footer    TEXT,
  receipt_terms     TEXT,
  receipt_accent    TEXT,
  receipt_paper     TEXT DEFAULT 'a4',
  receipt_show_logo    INTEGER DEFAULT 1,
  receipt_show_contact INTEGER DEFAULT 1,
  receipt_show_staff   INTEGER DEFAULT 1,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  device_id         TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  device_id   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_categories_sync ON categories(store_id, updated_at);

CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_suppliers_sync ON suppliers(store_id, updated_at);

CREATE TABLE IF NOT EXISTS staff (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'cashier',
  pin_salt    TEXT NOT NULL,
  pin_hash    TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  device_id   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_staff_sync ON staff(store_id, updated_at);

CREATE TABLE IF NOT EXISTS customers (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_customers_sync ON customers(store_id, updated_at);

CREATE TABLE IF NOT EXISTS products (
  id                  TEXT PRIMARY KEY,
  store_id            TEXT NOT NULL,
  category_id         TEXT,
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
  version             INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_products_sync ON products(store_id, updated_at);

CREATE TABLE IF NOT EXISTS sales (
  id             TEXT PRIMARY KEY,
  store_id       TEXT NOT NULL,
  invoice_no     TEXT NOT NULL,
  customer_id    TEXT,
  cashier_id     TEXT,
  staff_id       TEXT,
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
  version        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sales_sync ON sales(store_id, updated_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id                    TEXT PRIMARY KEY,
  sale_id               TEXT NOT NULL,
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
  device_id             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id, created_at);

CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  sale_id      TEXT NOT NULL,
  type         TEXT NOT NULL,
  display_name TEXT,
  amount       INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  device_id    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id, created_at);

CREATE TABLE IF NOT EXISTS stock_movements (
  id             TEXT PRIMARY KEY,
  store_id       TEXT NOT NULL,
  product_id     TEXT NOT NULL,
  type           TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reference_type TEXT,
  reference_id   TEXT,
  note           TEXT,
  created_at     INTEGER NOT NULL,
  device_id      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sync ON stock_movements(store_id, created_at);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id             TEXT PRIMARY KEY,
  store_id       TEXT NOT NULL,
  customer_id    TEXT NOT NULL,
  type           TEXT NOT NULL,
  amount         INTEGER NOT NULL,
  reference_type TEXT,
  reference_id   TEXT,
  note           TEXT,
  created_at     INTEGER NOT NULL,
  device_id      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_sync ON customer_ledger(store_id, created_at);

CREATE TABLE IF NOT EXISTS returns (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL,
  sale_id       TEXT NOT NULL,
  customer_id   TEXT,
  refund_method TEXT NOT NULL,
  subtotal      INTEGER NOT NULL,
  tax_total     INTEGER NOT NULL DEFAULT 0,
  grand_total   INTEGER NOT NULL,
  reason        TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  device_id     TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_returns_sync ON returns(store_id, updated_at);

CREATE TABLE IF NOT EXISTS return_items (
  id                    TEXT PRIMARY KEY,
  return_id             TEXT NOT NULL,
  sale_item_id          TEXT NOT NULL,
  product_id            TEXT,
  product_name_snapshot TEXT NOT NULL,
  unit_cost             INTEGER NOT NULL DEFAULT 0,
  unit_price            INTEGER NOT NULL,
  quantity              INTEGER NOT NULL,
  tax                   INTEGER NOT NULL DEFAULT 0,
  line_total            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  device_id             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id, created_at);

CREATE TABLE IF NOT EXISTS purchases (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL,
  supplier_id  TEXT,
  reference_no TEXT NOT NULL,
  total        INTEGER NOT NULL,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'received',
  purchased_at INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  device_id    TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_purchases_sync ON purchases(store_id, updated_at);

CREATE TABLE IF NOT EXISTS purchase_items (
  id                    TEXT PRIMARY KEY,
  purchase_id           TEXT NOT NULL,
  product_id            TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  unit_cost             INTEGER NOT NULL,
  quantity              INTEGER NOT NULL,
  line_total            INTEGER NOT NULL,
  created_at            INTEGER NOT NULL,
  device_id             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id, created_at);
