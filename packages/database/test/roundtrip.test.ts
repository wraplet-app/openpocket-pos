import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  MIGRATIONS, runMigrations, type SqlExecutor,
  SYNC_TABLES, upsertSql, rowValues, pullSql, changedSinceSql, rowStoreId,
} from '../src/index.ts';

// End-to-end simulation of the sync engine: a device pushes to the "server"
// (D1 is SQLite too), another device pulls. Uses the SAME SQL the Worker and
// app use, so it proves the real reconcile behaviour, not a mock.

function adapter(db: DatabaseSync): SqlExecutor {
  return { exec: async (s) => { db.exec(s); }, select: async <T>(s: string) => db.prepare(s).all() as T[] };
}
async function makeDb() { const db = new DatabaseSync(':memory:'); await runMigrations(adapter(db), MIGRATIONS); return db; }
const bind = (v: unknown[]) => v as (string | number | null)[];
const tableOf = (n: string) => SYNC_TABLES.find((t) => t.name === n)!;

function put(db: DatabaseSync, name: string, row: Record<string, unknown>) {
  const t = tableOf(name);
  db.prepare(upsertSql(t)).run(...bind(rowValues(t, row)));
}

// Mirror of the Worker's push handler.
function serverPush(server: DatabaseSync, storeId: string, tables: Record<string, Record<string, unknown>[]>) {
  for (const t of SYNC_TABLES) {
    for (const row of tables[t.name] ?? []) {
      const owner = rowStoreId(t, row);
      if (owner !== null && owner !== storeId) continue; // reject cross-store
      server.prepare(upsertSql(t)).run(...bind(rowValues(t, row)));
    }
  }
}
// Mirror of the Worker's pull handler.
function serverPull(server: DatabaseSync, storeId: string, since: number) {
  const out: Record<string, Record<string, unknown>[]> = {};
  let cursor = since;
  for (const t of SYNC_TABLES) {
    const rows = server.prepare(pullSql(t)).all(storeId, since) as Record<string, unknown>[];
    out[t.name] = rows;
    for (const r of rows) { const ts = Number(r[t.timeColumn]); if (ts > cursor) cursor = ts; }
  }
  return { tables: out, cursor };
}
// Mirror of the app's push gather.
function devicePush(device: DatabaseSync, since: number) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of SYNC_TABLES) {
    const rows = device.prepare(changedSinceSql(t)).all(since) as Record<string, unknown>[];
    if (rows.length) tables[t.name] = rows;
  }
  return tables;
}
// Mirror of the app's pull apply.
function deviceApply(device: DatabaseSync, tables: Record<string, Record<string, unknown>[]>) {
  for (const t of SYNC_TABLES) for (const row of tables[t.name] ?? []) device.prepare(upsertSql(t)).run(...bind(rowValues(t, row)));
}

const store = (id: string, name: string, u: number) => ({ id, name, currency_code: 'PKR', currency_locale: 'en-PK', currency_decimals: 2, address: null, phone: null, created_at: 0, updated_at: u, device_id: 'A', version: 1 });
const product = (id: string, s: string, name: string, price: number, u: number, v = 1, dev = 'A') => ({ id, store_id: s, category_id: null, name, sku: null, barcode: null, cost_price: 0, selling_price: price, unit: 'unit', track_inventory: 1, low_stock_threshold: null, tax_bps: 0, image_uri: null, active: 1, created_at: 0, updated_at: u, deleted_at: null, device_id: dev, version: v });

test('a full store round-trips device -> server -> new device', async () => {
  const A = await makeDb(), server = await makeDb(), B = await makeDb();
  put(A, 'stores', store('s1', 'Bin Hashim', 100));
  put(A, 'products', product('p1', 's1', 'Cola', 5000, 100));
  const sale = { id: 'sale1', store_id: 's1', invoice_no: 'INV-1', customer_id: null, cashier_id: null, staff_id: null, status: 'completed', subtotal: 5000, discount_total: 0, tax_total: 0, grand_total: 5000, note: null, sold_at: 120, created_at: 120, updated_at: 120, device_id: 'A', version: 1 };
  put(A, 'sales', sale);
  put(A, 'sale_items', { id: 'si1', sale_id: 'sale1', product_id: 'p1', product_name_snapshot: 'Cola', sku_snapshot: null, unit_cost: 0, unit_price: 5000, quantity: 1, discount: 0, tax: 0, line_total: 5000, created_at: 120, device_id: 'A' });
  put(A, 'payments', { id: 'pay1', sale_id: 'sale1', type: 'cash', display_name: null, amount: 5000, created_at: 120, device_id: 'A' });

  // A pushes everything, B (fresh) pulls it.
  serverPush(server, 's1', devicePush(A, 0));
  const pulled = serverPull(server, 's1', 0);
  deviceApply(B, pulled.tables);

  assert.equal((B.prepare(`SELECT name FROM stores WHERE id='s1'`).get() as any).name, 'Bin Hashim');
  assert.equal((B.prepare(`SELECT COUNT(*) c FROM products WHERE store_id='s1'`).get() as any).c, 1);
  assert.equal((B.prepare(`SELECT COUNT(*) c FROM sale_items WHERE sale_id='sale1'`).get() as any).c, 1);
  assert.equal((B.prepare(`SELECT amount FROM payments WHERE id='pay1'`).get() as any).amount, 5000);
});

test('concurrent edits reconcile by last-writer-wins through the server', async () => {
  const A = await makeDb(), server = await makeDb(), B = await makeDb();
  put(A, 'stores', store('s1', 'Shop', 100));
  put(A, 'products', product('p1', 's1', 'Cola', 5000, 100));
  serverPush(server, 's1', devicePush(A, 0));
  deviceApply(B, serverPull(server, 's1', 0).tables);

  // B edits price at t=200; A edits name at t=300 (later wins on its fields).
  put(B, 'products', product('p1', 's1', 'Cola', 4000, 200, 2, 'B'));
  put(A, 'products', product('p1', 's1', 'Coca-Cola', 5500, 300, 2, 'A'));
  serverPush(server, 's1', devicePush(B, 100));
  serverPush(server, 's1', devicePush(A, 100));

  const serverRow = server.prepare(`SELECT name, selling_price, updated_at FROM products WHERE id='p1'`).get() as any;
  assert.equal(serverRow.name, 'Coca-Cola');       // A's later write wins
  assert.equal(serverRow.selling_price, 5500);
  assert.equal(serverRow.updated_at, 300);

  // Both devices converge after pulling.
  deviceApply(A, serverPull(server, 's1', 0).tables);
  deviceApply(B, serverPull(server, 's1', 0).tables);
  assert.equal((A.prepare(`SELECT name FROM products WHERE id='p1'`).get() as any).name, 'Coca-Cola');
  assert.equal((B.prepare(`SELECT name FROM products WHERE id='p1'`).get() as any).name, 'Coca-Cola');
});

test('server rejects rows belonging to another store', async () => {
  const server = await makeDb();
  // Attacker on store s1 tries to push a product owned by s2.
  serverPush(server, 's1', { stores: [store('s1', 'Mine', 10)], products: [product('evil', 's2', 'Hack', 1, 10)] });
  assert.equal((server.prepare(`SELECT COUNT(*) c FROM products WHERE id='evil'`).get() as any).c, 0);
  assert.equal((server.prepare(`SELECT COUNT(*) c FROM stores WHERE id='s1'`).get() as any).c, 1);
});
