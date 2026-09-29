import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  MIGRATIONS, runMigrations, type SqlExecutor,
  SYNC_TABLES, upsertSql, rowValues, pullSql, changedSinceSql,
} from '../src/index.ts';

function adapter(db: DatabaseSync): SqlExecutor {
  return { exec: async (sql) => { db.exec(sql); }, select: async <T>(sql: string) => db.prepare(sql).all() as T[] };
}

const tableOf = (name: string) => SYNC_TABLES.find((t) => t.name === name)!;

async function freshDb(): Promise<DatabaseSync> {
  const db = new DatabaseSync(':memory:');
  await runMigrations(adapter(db), MIGRATIONS);
  return db;
}

function upsert(db: DatabaseSync, name: string, row: Record<string, unknown>) {
  const t = tableOf(name);
  db.prepare(upsertSql(t)).run(...(rowValues(t, row) as (string | number | null)[]));
}

const store = (id: string, name: string, updated: number, version = 1) => ({
  id, name, currency_code: 'PKR', currency_locale: 'en-PK', currency_decimals: 2,
  address: null, phone: null, created_at: 0, updated_at: updated, device_id: 'd1', version,
});

const product = (id: string, storeId: string, name: string, price: number, updated: number, version = 1) => ({
  id, store_id: storeId, category_id: null, name, sku: null, barcode: null, cost_price: 0,
  selling_price: price, unit: 'unit', track_inventory: 1, low_stock_threshold: null, tax_bps: 0,
  image_uri: null, active: 1, created_at: 0, updated_at: updated, deleted_at: null, device_id: 'd1', version,
});

test('mutable upsert is last-writer-wins by updated_at', async () => {
  const db = await freshDb();
  upsert(db, 'stores', store('s1', 'Shop', 100));
  upsert(db, 'products', product('p1', 's1', 'Cola', 5000, 100));

  // newer update wins
  upsert(db, 'products', product('p1', 's1', 'Cola 500ml', 5500, 200));
  let row = db.prepare(`SELECT name, selling_price FROM products WHERE id='p1'`).get() as any;
  assert.equal(row.name, 'Cola 500ml');
  assert.equal(row.selling_price, 5500);

  // older update is ignored (a laggy device must not clobber a newer edit)
  upsert(db, 'products', product('p1', 's1', 'STALE', 1, 150));
  row = db.prepare(`SELECT name, selling_price FROM products WHERE id='p1'`).get() as any;
  assert.equal(row.name, 'Cola 500ml');
  assert.equal(row.selling_price, 5500);
});

test('equal updated_at falls back to higher version', async () => {
  const db = await freshDb();
  upsert(db, 'stores', store('s1', 'Shop', 100));
  upsert(db, 'products', product('p1', 's1', 'A', 100, 500, 1));
  upsert(db, 'products', product('p1', 's1', 'B', 200, 500, 2)); // same time, higher version
  const row = db.prepare(`SELECT name FROM products WHERE id='p1'`).get() as any;
  assert.equal(row.name, 'B');
});

test('append rows are insert-if-absent and replay is a no-op', async () => {
  const db = await freshDb();
  upsert(db, 'stores', store('s1', 'Shop', 100));
  upsert(db, 'products', product('p1', 's1', 'Cola', 5000, 100));
  const mv = { id: 'm1', store_id: 's1', product_id: 'p1', type: 'sale', quantity_delta: -2, reference_type: 'sale', reference_id: null, note: null, created_at: 10, device_id: 'd1' };
  upsert(db, 'stock_movements', mv);
  upsert(db, 'stock_movements', { ...mv, quantity_delta: -999 }); // replay must NOT overwrite
  const rows = db.prepare(`SELECT quantity_delta FROM stock_movements WHERE id='m1'`).all() as any[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity_delta, -2);
});

test('pull is scoped to one store, including child tables via parent', async () => {
  const db = await freshDb();
  upsert(db, 'stores', store('s1', 'Shop One', 100));
  upsert(db, 'stores', store('s2', 'Shop Two', 100));
  upsert(db, 'products', product('p1', 's1', 'Own', 100, 100));
  upsert(db, 'products', product('p2', 's2', 'Other', 100, 100));

  // a sale in s1 with a child sale_item (child has no store_id of its own)
  const sale = { id: 'sale1', store_id: 's1', invoice_no: 'INV-1', customer_id: null, cashier_id: null, staff_id: null, status: 'completed', subtotal: 100, discount_total: 0, tax_total: 0, grand_total: 100, note: null, sold_at: 50, created_at: 50, updated_at: 50, device_id: 'd1', version: 1 };
  upsert(db, 'sales', sale);
  upsert(db, 'sale_items', { id: 'si1', sale_id: 'sale1', product_id: 'p1', product_name_snapshot: 'Own', sku_snapshot: null, unit_cost: 0, unit_price: 100, quantity: 1, discount: 0, tax: 0, line_total: 100, created_at: 50, device_id: 'd1' });

  const pullProducts = tableOf('products');
  const own = db.prepare(pullSql(pullProducts)).all('s1', 0) as any[];
  assert.deepEqual(own.map((r) => r.id).sort(), ['p1']); // not p2

  const pullItems = tableOf('sale_items');
  const items = db.prepare(pullSql(pullItems)).all('s1', 0) as any[];
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'si1');
  // s2 sees none of s1's child rows
  assert.equal((db.prepare(pullSql(pullItems)).all('s2', 0) as any[]).length, 0);
});

test('changedSince only returns rows past the cursor', async () => {
  const db = await freshDb();
  upsert(db, 'stores', store('s1', 'Shop', 100));
  upsert(db, 'products', product('old', 's1', 'Old', 100, 100));
  upsert(db, 'products', product('new', 's1', 'New', 100, 300));
  const changed = db.prepare(changedSinceSql(tableOf('products'))).all(200) as any[];
  assert.deepEqual(changed.map((r) => r.id), ['new']);
});
