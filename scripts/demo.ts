/**
 * Local end-to-end smoke run of the V0.1 core: real migration runner, real
 * pricing engine, real SQLite (node:sqlite). Rings up a cash sale atomically
 * and reads it back. No mocks.
 *
 *   node scripts/demo.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { MIGRATIONS, runMigrations, type SqlExecutor } from '../packages/database/src/index.ts';
import {
  computeCart,
  settlePayments,
  suggestCashAmounts,
  lineProfit,
  format,
  asMinor,
  asBps,
} from '../packages/pos-core/src/index.ts';
import type { CurrencyConfig } from '../packages/types/src/index.ts';

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

const exec: SqlExecutor = {
  exec: async (sql) => { db.exec(sql); },
  select: async <T>(sql: string) => db.prepare(sql).all() as T[],
};

const now = Date.now();
const DEVICE = 'demo-device';
const currency: CurrencyConfig = { code: 'PKR', locale: 'en-PK', decimals: 2 };

function run<T extends unknown[]>(sql: string, params: T): void {
  db.prepare(sql).run(...params);
}

async function main() {
  console.log('applying migrations:', await runMigrations(exec, MIGRATIONS));

  // --- onboarding: store, category, product -------------------------------
  const storeId = randomUUID();
  run(
    `INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,?,1)`,
    [storeId, 'Kashif Mini Mart', currency.code, currency.locale, currency.decimals, now, now, DEVICE],
  );

  const catId = randomUUID();
  run(
    `INSERT INTO categories (id,store_id,name,sort_order,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,1)`,
    [catId, storeId, 'Beverages', 0, now, now, DEVICE],
  );

  const prodId = randomUUID();
  const sellingPrice = asMinor(15000); // Rs 150.00
  const costPrice = asMinor(10000);    // Rs 100.00
  run(
    `INSERT INTO products (id,store_id,category_id,name,sku,barcode,cost_price,selling_price,unit,track_inventory,tax_bps,active,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,?,?,1,?,1,?,?,?,1)`,
    [prodId, storeId, catId, 'Cola 500ml', 'COLA-500', '890000000001', costPrice, sellingPrice, 'bottle', 0, now, now, DEVICE],
  );

  // opening stock 24
  run(
    `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,note,created_at,device_id)
     VALUES (?,?,?,'opening_stock',?,?,?,?,?)`,
    [randomUUID(), storeId, prodId, 24, 'opening', 'initial count', now, DEVICE],
  );

  // --- POS: cart of 3, 5% line tax, cash --------------------------------
  const qty = 3;
  const totals = computeCart([
    { unitPrice: sellingPrice, quantity: qty, taxBps: asBps(500) },
  ]);

  const received = asMinor(50000); // Rs 500.00 cash
  const settlement = settlePayments(totals.grandTotal, [{ amount: received }]);
  const suggestions = suggestCashAmounts(totals.grandTotal, [asMinor(10000), asMinor(50000)]);

  // --- atomic checkout: sale + item + payment + stock movement ----------
  const saleId = randomUUID();
  db.exec('BEGIN;');
  try {
    run(
      `INSERT INTO sales (id,store_id,invoice_no,status,subtotal,discount_total,tax_total,grand_total,sold_at,created_at,updated_at,device_id,version)
       VALUES (?,?,?,'completed',?,?,?,?,?,?,?,?,1)`,
      [saleId, storeId, 'INV-0001', totals.subtotal, totals.discountTotal, totals.taxTotal, totals.grandTotal, now, now, now, DEVICE],
    );
    const line = totals.lines[0]!;
    run(
      `INSERT INTO sale_items (id,sale_id,product_id,product_name_snapshot,sku_snapshot,unit_cost,unit_price,quantity,discount,tax,line_total,created_at,device_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), saleId, prodId, 'Cola 500ml', 'COLA-500', costPrice, sellingPrice, qty, line.discount, line.tax, line.lineTotal, now, DEVICE],
    );
    run(
      `INSERT INTO payments (id,sale_id,type,display_name,amount,created_at,device_id)
       VALUES (?,?,'cash',NULL,?,?,?)`,
      [randomUUID(), saleId, totals.grandTotal, now, DEVICE],
    );
    run(
      `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
       VALUES (?,?,?,'sale',?,?,?,?,?)`,
      [randomUUID(), storeId, prodId, -qty, 'sale', saleId, now, DEVICE],
    );
    db.exec('COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }

  // --- read back --------------------------------------------------------
  const stock = (db.prepare(
    `SELECT COALESCE(SUM(quantity_delta),0) AS qty FROM stock_movements WHERE product_id = ?`,
  ).get(prodId) as { qty: number }).qty;

  const profit = lineProfit({ unitPrice: sellingPrice, unitCost: costPrice, quantity: qty, taxBps: 500 });

  console.log('\n──────── RECEIPT ────────');
  console.log('Kashif Mini Mart          INV-0001');
  console.log(`Cola 500ml   ${qty} x ${format(sellingPrice, currency)}`);
  console.log(`Subtotal              ${format(totals.subtotal, currency)}`);
  console.log(`Tax (5%)              ${format(totals.taxTotal, currency)}`);
  console.log(`TOTAL                 ${format(totals.grandTotal, currency)}`);
  console.log(`Cash                  ${format(received, currency)}`);
  console.log(`Change                ${format(settlement.change, currency)}`);
  console.log('─────────────────────────');
  console.log('quick-cash buttons:', suggestions.map((s) => format(s, currency)).join('  '));
  console.log('stock now:', stock, '(24 opening − 3 sold)');
  console.log('gross profit on sale:', format(profit, currency));
  console.log('sale rows in db:', (db.prepare('SELECT COUNT(*) c FROM sales').get() as { c: number }).c);

  // assertions so this doubles as a smoke test
  if (settlement.change !== 2750) throw new Error('change mismatch');
  if (stock !== 21) throw new Error('stock mismatch');
  console.log('\nOK ✅  end-to-end sale recorded and verified locally.');
}

main().catch((e) => { console.error(e); process.exit(1); });
