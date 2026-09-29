/**
 * Local POS test server. Uses the REAL @openpocket/pos-core pricing engine and
 * @openpocket/database migrations against a file-backed node:sqlite database
 * (so data survives restart — the offline-first guarantee). No mocks.
 *
 *   node scripts/server.ts
 * then open http://localhost:5178
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, runMigrations, type SqlExecutor } from '../packages/database/src/index.ts';
import {
  computeCart,
  settlePayments,
  suggestCashAmounts,
  format,
  asMinor,
  asBps,
  type CartLineInput,
} from '../packages/pos-core/src/index.ts';
import type { CurrencyConfig } from '../packages/types/src/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '.data');
mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, 'pos.db'));
db.exec('PRAGMA foreign_keys = ON;');

const exec: SqlExecutor = {
  exec: async (sql) => { db.exec(sql); },
  select: async <T>(sql: string) => db.prepare(sql).all() as T[],
};

const DEVICE = 'local-server';
const currency: CurrencyConfig = { code: 'PKR', locale: 'en-PK', decimals: 2 };

interface ProductRow {
  id: string; name: string; selling_price: number; cost_price: number; tax_bps: number;
}

function seedIfEmpty(): void {
  const storeCount = (db.prepare('SELECT COUNT(*) c FROM stores').get() as { c: number }).c;
  if (storeCount > 0) return;
  const now = Date.now();
  const storeId = randomUUID();
  db.prepare(
    `INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,?,1)`,
  ).run(storeId, 'Test Mart', currency.code, currency.locale, currency.decimals, now, now, DEVICE);

  const products: [string, number, number, number][] = [
    // name, selling (minor), cost (minor), tax_bps
    ['Cola 500ml', 15000, 10000, 500],
    ['Bread', 12000, 8000, 0],
    ['Milk 1L', 25000, 19000, 0],
    ['Chips', 5000, 3000, 500],
    ['Soap', 8000, 5500, 1700],
    ['Eggs (dozen)', 30000, 24000, 0],
    ['Tea 250g', 45000, 36000, 500],
    ['Rice 1kg', 22000, 17000, 0],
  ];
  for (const [name, price, cost, tax] of products) {
    const pid = randomUUID();
    db.prepare(
      `INSERT INTO products (id,store_id,name,cost_price,selling_price,unit,track_inventory,tax_bps,active,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?,1,?,1,?,?,?,1)`,
    ).run(pid, storeId, name, cost, price, 'unit', tax, now, now, DEVICE);
    db.prepare(
      `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,created_at,device_id)
       VALUES (?,?,?,'opening_stock',?, 'opening', ?, ?)`,
    ).run(randomUUID(), storeId, pid, 50, now, DEVICE);
  }
  console.log('seeded store + 8 products');
}

function storeId(): string {
  return (db.prepare('SELECT id FROM stores LIMIT 1').get() as { id: string }).id;
}

function stockFor(productId: string): number {
  return (db.prepare(
    'SELECT COALESCE(SUM(quantity_delta),0) q FROM stock_movements WHERE product_id=?',
  ).get(productId) as { q: number }).q;
}

function getState() {
  const store = db.prepare('SELECT name FROM stores LIMIT 1').get() as { name: string };
  const rows = db.prepare(
    'SELECT id,name,selling_price,cost_price,tax_bps FROM products WHERE active=1 AND deleted_at IS NULL ORDER BY name',
  ).all() as ProductRow[];
  const products = rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.selling_price,
    priceLabel: format(asMinor(r.selling_price), currency),
    taxBps: r.tax_bps,
    stock: stockFor(r.id),
  }));
  const salesCount = (db.prepare('SELECT COUNT(*) c FROM sales').get() as { c: number }).c;
  return { store: store.name, currency, products, salesCount };
}

interface CheckoutBody {
  items: { productId: string; quantity: number }[];
  received: number; // minor units
}

function checkout(body: CheckoutBody) {
  const now = Date.now();
  const sid = storeId();
  const rows = body.items.map((it) => {
    const p = db.prepare('SELECT id,name,selling_price,cost_price,tax_bps FROM products WHERE id=?')
      .get(it.productId) as ProductRow | undefined;
    if (!p) throw new Error(`unknown product ${it.productId}`);
    return { it, p };
  });

  const cartInputs: CartLineInput[] = rows.map(({ it, p }) => ({
    unitPrice: asMinor(p.selling_price),
    quantity: it.quantity,
    taxBps: asBps(p.tax_bps),
  }));
  const totals = computeCart(cartInputs);
  const settlement = settlePayments(totals.grandTotal, [{ amount: asMinor(body.received) }]);

  const invoiceNo = `INV-${String((db.prepare('SELECT COUNT(*) c FROM sales').get() as { c: number }).c + 1).padStart(4, '0')}`;
  const saleId = randomUUID();

  db.exec('BEGIN;');
  try {
    db.prepare(
      `INSERT INTO sales (id,store_id,invoice_no,status,subtotal,discount_total,tax_total,grand_total,sold_at,created_at,updated_at,device_id,version)
       VALUES (?,?,?,'completed',?,?,?,?,?,?,?,?,1)`,
    ).run(saleId, sid, invoiceNo, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.grandTotal, now, now, now, DEVICE);

    rows.forEach(({ it, p }, i) => {
      const line = totals.lines[i]!;
      db.prepare(
        `INSERT INTO sale_items (id,sale_id,product_id,product_name_snapshot,sku_snapshot,unit_cost,unit_price,quantity,discount,tax,line_total,created_at,device_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(randomUUID(), saleId, p.id, p.name, null, p.cost_price, p.selling_price, it.quantity, line.discount, line.tax, line.lineTotal, now, DEVICE);
      db.prepare(
        `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
         VALUES (?,?,?,'sale',?, 'sale', ?, ?, ?)`,
      ).run(randomUUID(), sid, p.id, -it.quantity, saleId, now, DEVICE);
    });

    db.prepare(
      `INSERT INTO payments (id,sale_id,type,amount,created_at,device_id) VALUES (?,?,'cash',?,?,?)`,
    ).run(randomUUID(), saleId, totals.grandTotal, now, DEVICE);
    db.exec('COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }

  return {
    invoiceNo,
    lines: rows.map(({ it, p }, i) => ({
      name: p.name,
      quantity: it.quantity,
      unitPrice: format(asMinor(p.selling_price), currency),
      lineTotal: format(totals.lines[i]!.lineTotal, currency),
    })),
    subtotal: format(totals.subtotal, currency),
    tax: format(totals.taxTotal, currency),
    total: format(totals.grandTotal, currency),
    received: format(asMinor(body.received), currency),
    change: format(settlement.change, currency),
  };
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
}

const INDEX = readFileSync(join(__dirname, 'pos-ui.html'), 'utf8');

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(INDEX);
      return;
    }
    if (req.method === 'GET' && req.url === '/api/state') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(getState()));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/checkout') {
      const body = JSON.parse(await readBody(req)) as CheckoutBody;
      const receipt = checkout(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ receipt, state: getState() }));
      return;
    }
    res.writeHead(404).end('not found');
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
});

await runMigrations(exec, MIGRATIONS);
seedIfEmpty();
const PORT = 5178;
server.listen(PORT, () => console.log(`OpenPocket POS test server → http://localhost:${PORT}`));
