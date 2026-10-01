/**
 * Repositories: the ONLY place that talks SQL. All money math is delegated to
 * @openpocket/pos-core; screens never compute totals themselves.
 */
import {
  computeCart,
  settlePayments,
  roundHalfAwayFromZero,
  asMinor,
  asBps,
  type CartLineInput,
  type Minor,
} from '@openpocket/pos-core';
import { getDb } from './db';
import { newId, DEVICE_ID } from './id';
import { type Role, hashPin, verifyPin, randomSalt } from './roles';

export type ReceiptPaper = 'a4' | 'thermal80' | 'thermal58';

export interface Store {
  id: string;
  name: string;
  currency_code: string;
  currency_locale: string;
  currency_decimals: number;
  // Shop profile + receipt look. All optional; NULL means "use the default".
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  tax_id?: string | null;
  tagline?: string | null;
  logo_uri?: string | null;
  receipt_footer?: string | null;
  receipt_terms?: string | null;
  receipt_accent?: string | null;
  receipt_paper?: ReceiptPaper | null;
  receipt_show_logo?: number | null;
  receipt_show_contact?: number | null;
  receipt_show_staff?: number | null;
}

/** The editable subset of Store (everything except identity + currency). */
export interface StoreProfile {
  name: string;
  address: string; phone: string; email: string; website: string; taxId: string; tagline: string;
  logoUri: string | null;
  receiptFooter: string; receiptTerms: string; receiptAccent: string;
  receiptPaper: ReceiptPaper;
  showLogo: boolean; showContact: boolean; showStaff: boolean;
}

export const DEFAULT_RECEIPT_ACCENT = '#0ca678';
export const DEFAULT_RECEIPT_FOOTER = 'Thank you for your business!';

export function profileOf(s: Store): StoreProfile {
  return {
    name: s.name, address: s.address ?? '', phone: s.phone ?? '', email: s.email ?? '', website: s.website ?? '',
    taxId: s.tax_id ?? '', tagline: s.tagline ?? '', logoUri: s.logo_uri ?? null,
    receiptFooter: s.receipt_footer ?? '', receiptTerms: s.receipt_terms ?? '',
    receiptAccent: s.receipt_accent ?? DEFAULT_RECEIPT_ACCENT,
    receiptPaper: s.receipt_paper ?? 'a4',
    showLogo: (s.receipt_show_logo ?? 1) === 1, showContact: (s.receipt_show_contact ?? 1) === 1, showStaff: (s.receipt_show_staff ?? 1) === 1,
  };
}

const clean = (v: string) => v.trim() || null;

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  image_uri: string | null;
  selling_price: number;
  cost_price: number;
  tax_bps: number;
  stock: number;
  sku?: string | null;
  unit?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  low_stock_threshold?: number | null;
  isQuick?: boolean; // true for ad-hoc "quick sale" lines with no catalog product
}

export type PaymentMethod = 'cash' | 'card' | 'bank' | 'credit';

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.barcode, p.image_uri, p.selling_price, p.cost_price, p.tax_bps,
         p.sku, p.unit, p.category_id, p.low_stock_threshold, c.name AS category_name,
         COALESCE((SELECT SUM(sm.quantity_delta) FROM stock_movements sm WHERE sm.product_id = p.id), 0) AS stock
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

/** Stock level at or below which a product counts as "low" (per-product, default 5). */
export const DEFAULT_LOW_STOCK = 5;
export const isLowStock = (p: Pick<Product, 'stock' | 'low_stock_threshold'>) =>
  p.stock > 0 && p.stock <= (p.low_stock_threshold ?? DEFAULT_LOW_STOCK);

/** The shop currently in use on this device (multi-shop aware). */
export async function getStore(): Promise<Store | null> {
  const db = getDb();
  const ptr = await db.getFirstAsync<{ current_store_id: string | null }>('SELECT current_store_id FROM app_state WHERE id=1');
  if (ptr?.current_store_id) {
    const s = await db.getFirstAsync<Store>('SELECT * FROM stores WHERE id=?', [ptr.current_store_id]);
    if (s) return s;
  }
  // No/stale pointer: fall back to the oldest shop and adopt it as current.
  const first = await db.getFirstAsync<Store>('SELECT * FROM stores ORDER BY created_at LIMIT 1');
  if (first) await db.runAsync('UPDATE app_state SET current_store_id=? WHERE id=1', [first.id]);
  return first ?? null;
}

/** All shops on this device, oldest first. */
export async function listStores(): Promise<Store[]> {
  return getDb().getAllAsync<Store>('SELECT * FROM stores ORDER BY created_at');
}

/** Point the device at a different shop. */
export async function setCurrentStore(id: string): Promise<void> {
  await getDb().runAsync('UPDATE app_state SET current_store_id=? WHERE id=1', [id]);
}

export async function createStore(
  name: string,
  currency: { code: string; locale: string; decimals: number },
  profile: Partial<StoreProfile> = {},
): Promise<Store> {
  const id = newId();
  const now = Date.now();
  const p = profile;
  await getDb().runAsync(
    `INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,
        address,phone,email,website,tax_id,tagline,logo_uri,
        receipt_footer,receipt_terms,receipt_accent,receipt_paper,receipt_show_logo,receipt_show_contact,receipt_show_staff,
        created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,1)`,
    [id, name, currency.code, currency.locale, currency.decimals,
      clean(p.address ?? ''), clean(p.phone ?? ''), clean(p.email ?? ''), clean(p.website ?? ''), clean(p.taxId ?? ''), clean(p.tagline ?? ''), p.logoUri ?? null,
      clean(p.receiptFooter ?? ''), clean(p.receiptTerms ?? ''), p.receiptAccent ?? null, p.receiptPaper ?? 'a4',
      p.showLogo === false ? 0 : 1, p.showContact === false ? 0 : 1, p.showStaff === false ? 0 : 1,
      now, now, DEVICE_ID],
  );
  await setCurrentStore(id); // a newly created shop becomes the active one
  return (await getDb().getFirstAsync<Store>('SELECT * FROM stores WHERE id=?', [id]))!;
}

/** Save the shop profile + receipt look. Bumps version so it syncs. */
export async function updateStoreProfile(storeId: string, p: StoreProfile): Promise<Store> {
  if (!p.name.trim()) throw new Error('Shop name is required');
  await getDb().runAsync(
    `UPDATE stores SET name=?, address=?, phone=?, email=?, website=?, tax_id=?, tagline=?, logo_uri=?,
        receipt_footer=?, receipt_terms=?, receipt_accent=?, receipt_paper=?,
        receipt_show_logo=?, receipt_show_contact=?, receipt_show_staff=?,
        updated_at=?, version=version+1 WHERE id=?`,
    [p.name.trim(), clean(p.address), clean(p.phone), clean(p.email), clean(p.website), clean(p.taxId), clean(p.tagline), p.logoUri,
      clean(p.receiptFooter), clean(p.receiptTerms), p.receiptAccent || null, p.receiptPaper,
      p.showLogo ? 1 : 0, p.showContact ? 1 : 0, p.showStaff ? 1 : 0, Date.now(), storeId],
  );
  return (await getStore())!;
}

/* ------------------------------ categories ------------------------------ */

export interface Category { id: string; name: string }

export async function listCategories(storeId: string): Promise<Category[]> {
  return getDb().getAllAsync<Category>(
    'SELECT id, name FROM categories WHERE store_id=? ORDER BY sort_order, name', [storeId],
  );
}

/** Returns the existing category with this name (case-insensitive) or creates it. */
export async function ensureCategory(storeId: string, name: string): Promise<string> {
  const n = name.trim();
  if (!n) throw new Error('Category name is required');
  const db = getDb();
  const hit = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE store_id=? AND lower(name)=lower(?)', [storeId, n]);
  if (hit) return hit.id;
  const id = newId();
  const now = Date.now();
  const order = (await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories WHERE store_id=?', [storeId]))?.m ?? 0;
  await db.runAsync(
    `INSERT INTO categories (id,store_id,name,sort_order,created_at,updated_at,device_id,version) VALUES (?,?,?,?,?,?,?,1)`,
    [id, storeId, n, order + 1, now, now, DEVICE_ID]);
  return id;
}

export async function listProducts(storeId: string): Promise<Product[]> {
  return getDb().getAllAsync<Product>(
    `${PRODUCT_SELECT}
     WHERE p.store_id = ? AND p.active = 1 AND p.deleted_at IS NULL
     ORDER BY p.name`,
    [storeId],
  );
}

/** Look up a product by scanned barcode. Null if no active product matches. */
export async function findProductByBarcode(storeId: string, barcode: string): Promise<Product | null> {
  return (
    (await getDb().getFirstAsync<Product>(
      `${PRODUCT_SELECT}
       WHERE p.store_id = ? AND p.barcode = ? AND p.active = 1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [storeId, barcode],
    )) ?? null
  );
}

export async function createProduct(input: {
  storeId: string;
  name: string;
  barcode?: string | null;
  imageUri?: string | null;
  sellingPrice: Minor;
  costPrice: Minor;
  taxBps: number;
  openingStock: number;
  sku?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  lowStockThreshold?: number | null;
}): Promise<void> {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO products (id,store_id,category_id,name,sku,barcode,image_uri,cost_price,selling_price,unit,track_inventory,low_stock_threshold,tax_bps,active,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,1,?,?,?,1)`,
      [id, input.storeId, input.categoryId ?? null, input.name, input.sku?.trim() || null, input.barcode?.trim() || null, input.imageUri || null,
        input.costPrice, input.sellingPrice, input.unit?.trim() || 'unit', input.lowStockThreshold ?? null, input.taxBps, now, now, DEVICE_ID],
    );
    if (input.openingStock > 0) {
      await db.runAsync(
        `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,note,created_at,device_id)
         VALUES (?,?,?,'opening_stock',?, 'opening', 'initial stock', ?, ?)`,
        [newId(), input.storeId, id, input.openingStock, now, DEVICE_ID],
      );
    }
  });
}

export interface CheckoutLine {
  product: Product;
  quantity: number;
}

export interface Receipt {
  invoiceNo: string;
  paymentMethod: PaymentMethod;
  lines: { name: string; quantity: number; lineTotal: Minor }[];
  subtotal: Minor;
  discountTotal: Minor;
  taxTotal: Minor;
  grandTotal: Minor;
  received: Minor;
  change: Minor;
  soldAt: number;
}

export interface CheckoutOptions {
  paymentMethod: PaymentMethod;
  received: Minor;                 // for card/bank pass grandTotal; ignored for credit
  discountBps?: number;            // optional whole-order discount, basis points
  customerId?: string | null;      // required for credit sales; optional otherwise
  staffId?: string | null;         // who rang up the sale (null on legacy/unlocked stores)
}

/**
 * Atomic checkout: computes totals with pos-core, then writes sale + items
 * (with snapshots) + payment + negative stock movements in ONE transaction.
 * Throws (and rolls back) if cash payment is insufficient. Quick-sale lines
 * (isQuick) record product_id = NULL and create no stock movement.
 *
 * Credit sales record no payment row (nothing tendered) and add a +grandTotal
 * ledger entry against the customer; the balance is derived from the ledger.
 */
export async function checkoutSale(
  storeId: string,
  lines: CheckoutLine[],
  opts: CheckoutOptions,
): Promise<Receipt> {
  const db = getDb();
  const isCredit = opts.paymentMethod === 'credit';
  if (isCredit && !opts.customerId) throw new Error('Select a customer for a credit sale');

  const cartInputs: CartLineInput[] = lines.map((l) => ({
    unitPrice: asMinor(l.product.selling_price),
    quantity: l.quantity,
    taxBps: asBps(l.product.tax_bps),
  }));
  const cartDiscount = opts.discountBps && opts.discountBps > 0
    ? ({ kind: 'percent', bps: asBps(opts.discountBps) } as const)
    : ({ kind: 'none' } as const);
  const totals = computeCart(cartInputs, cartDiscount);
  const settlement = isCredit
    ? settlePayments(totals.grandTotal, [], { allowUnderpayment: true })
    : settlePayments(totals.grandTotal, [{ amount: opts.received }]); // throws if short

  const now = Date.now();
  const saleId = newId();
  const countRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sales WHERE store_id=?', [storeId]);
  const invoiceNo = `INV-${String((countRow?.c ?? 0) + 1).padStart(4, '0')}`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sales (id,store_id,invoice_no,customer_id,staff_id,status,subtotal,discount_total,tax_total,grand_total,sold_at,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,'completed',?,?,?,?,?,?,?,?,1)`,
      [saleId, storeId, invoiceNo, opts.customerId ?? null, opts.staffId ?? null, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.grandTotal, now, now, now, DEVICE_ID],
    );
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      const line = totals.lines[i]!;
      const productId = l.product.isQuick ? null : l.product.id;
      await db.runAsync(
        `INSERT INTO sale_items (id,sale_id,product_id,product_name_snapshot,sku_snapshot,unit_cost,unit_price,quantity,discount,tax,line_total,created_at,device_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [newId(), saleId, productId, l.product.name, null, l.product.cost_price, l.product.selling_price, l.quantity, line.discount, line.tax, line.lineTotal, now, DEVICE_ID],
      );
      if (productId) {
        await db.runAsync(
          `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
           VALUES (?,?,?,'sale',?, 'sale', ?, ?, ?)`,
          [newId(), storeId, productId, -l.quantity, saleId, now, DEVICE_ID],
        );
      }
    }
    if (isCredit) {
      // Nothing tendered — charge the customer's account via the ledger.
      await db.runAsync(
        `INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,reference_id,created_at,device_id)
         VALUES (?,?,?,'sale',?, 'sale', ?, ?, ?)`,
        [newId(), storeId, opts.customerId, totals.grandTotal, saleId, now, DEVICE_ID],
      );
    } else {
      await db.runAsync(
        `INSERT INTO payments (id,sale_id,type,amount,created_at,device_id) VALUES (?,?,?,?,?,?)`,
        [newId(), saleId, opts.paymentMethod, totals.grandTotal, now, DEVICE_ID],
      );
    }
  });

  return {
    invoiceNo,
    paymentMethod: opts.paymentMethod,
    lines: lines.map((l, i) => ({ name: l.product.name, quantity: l.quantity, lineTotal: totals.lines[i]!.lineTotal })),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    received: opts.received,
    change: settlement.change,
    soldAt: now,
  };
}

export async function salesCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sales');
  return row?.c ?? 0;
}

/* ------------------------------ dashboard ------------------------------- */

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface TodayStats { totalSales: number; orders: number; itemsSold: number }

export async function todayStats(storeId: string): Promise<TodayStats> {
  const db = getDb();
  const since = startOfToday();
  const sale = await db.getFirstAsync<{ total: number; orders: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total, COUNT(*) AS orders
     FROM sales WHERE store_id=? AND status='completed' AND sold_at >= ?`, [storeId, since],
  );
  const items = await db.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(SUM(si.quantity),0) AS n FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at >= ?`, [storeId, since],
  );
  return { totalSales: sale?.total ?? 0, orders: sale?.orders ?? 0, itemsSold: items?.n ?? 0 };
}

export interface SaleSummary {
  id: string; invoice_no: string; grand_total: number; sold_at: number; item_count: number;
  payment_method: string; staff_name: string | null;
}

export async function listSales(opts: { storeId: string; since?: number; limit?: number }): Promise<SaleSummary[]> {
  const { storeId, since, limit = 200 } = opts;
  return getDb().getAllAsync<SaleSummary>(
    `SELECT s.id, s.invoice_no, s.grand_total, s.sold_at,
            (SELECT COALESCE(SUM(quantity),0) FROM sale_items si WHERE si.sale_id = s.id) AS item_count,
            COALESCE((SELECT type FROM payments WHERE sale_id = s.id LIMIT 1), 'credit') AS payment_method,
            (SELECT name FROM staff WHERE staff.id = s.staff_id) AS staff_name
     FROM sales s WHERE s.store_id=? AND s.status='completed' ${since ? 'AND s.sold_at >= ?' : ''}
     ORDER BY s.sold_at DESC LIMIT ?`,
    since ? [storeId, since, limit] : [storeId, limit],
  );
}

/** Distinct products from recent sales, most-recently-sold first. */
export async function recentlySold(storeId: string, limit = 6): Promise<Product[]> {
  return getDb().getAllAsync<Product>(
    `${PRODUCT_SELECT}
     JOIN (
       SELECT si.product_id, MAX(s.sold_at) AS last_sold
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE si.product_id IS NOT NULL
       GROUP BY si.product_id
       ORDER BY last_sold DESC LIMIT ?
     ) r ON r.product_id = p.id
     WHERE p.store_id = ? AND p.active = 1 AND p.deleted_at IS NULL
     ORDER BY r.last_sold DESC`, [limit, storeId],
  );
}

/* ------------------------------ customers ------------------------------- */

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  balance: number; // derived from ledger; + = customer owes the store
}

const CUSTOMER_SELECT = `
  SELECT c.id, c.name, c.phone, c.email, c.address, c.notes,
         COALESCE((SELECT SUM(l.amount) FROM customer_ledger l WHERE l.customer_id = c.id), 0) AS balance
  FROM customers c`;

export async function listCustomers(storeId: string): Promise<Customer[]> {
  return getDb().getAllAsync<Customer>(
    `${CUSTOMER_SELECT}
     WHERE c.store_id = ? AND c.deleted_at IS NULL
     ORDER BY c.name`, [storeId],
  );
}

export async function searchCustomers(storeId: string, q: string): Promise<Customer[]> {
  const like = `%${q.trim()}%`;
  return getDb().getAllAsync<Customer>(
    `${CUSTOMER_SELECT}
     WHERE c.store_id = ? AND c.deleted_at IS NULL AND (c.name LIKE ? OR c.phone LIKE ?)
     ORDER BY c.name`, [storeId, like, like],
  );
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return (await getDb().getFirstAsync<Customer>(`${CUSTOMER_SELECT} WHERE c.id = ?`, [id])) ?? null;
}

export async function createCustomer(input: {
  storeId: string; name: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null;
}): Promise<string> {
  const id = newId();
  const now = Date.now();
  await getDb().runAsync(
    `INSERT INTO customers (id,store_id,name,phone,email,address,notes,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
    [id, input.storeId, input.name.trim(), input.phone?.trim() || null, input.email?.trim() || null, input.address?.trim() || null, input.notes?.trim() || null, now, now, DEVICE_ID],
  );
  return id;
}

export interface LedgerEntry {
  id: string;
  type: 'sale' | 'payment' | 'refund' | 'adjustment';
  amount: number; // signed minor units
  reference_id: string | null;
  note: string | null;
  created_at: number;
}

export async function customerLedger(customerId: string, limit = 100): Promise<LedgerEntry[]> {
  return getDb().getAllAsync<LedgerEntry>(
    `SELECT id, type, amount, reference_id, note, created_at
     FROM customer_ledger WHERE customer_id = ?
     ORDER BY created_at DESC LIMIT ?`, [customerId, limit],
  );
}

/** Record a customer paying down their balance. Adds a negative ledger entry. */
export async function recordCustomerPayment(
  storeId: string, customerId: string, amount: Minor, note?: string,
): Promise<void> {
  if (amount <= 0) throw new Error('Payment must be greater than zero');
  await getDb().runAsync(
    `INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,note,created_at,device_id)
     VALUES (?,?,?,'payment',?, 'manual', ?, ?, ?)`,
    [newId(), storeId, customerId, -amount, note?.trim() || null, Date.now(), DEVICE_ID],
  );
}

export interface OutstandingTotal { totalOwed: number; customersWithBalance: number }

export async function outstandingCredit(storeId: string): Promise<OutstandingTotal> {
  const row = await getDb().getFirstAsync<{ owed: number; n: number }>(
    `SELECT COALESCE(SUM(bal),0) AS owed, COUNT(*) AS n FROM (
       SELECT SUM(l.amount) AS bal FROM customer_ledger l
       JOIN customers c ON c.id = l.customer_id
       WHERE c.store_id = ? AND c.deleted_at IS NULL
       GROUP BY l.customer_id HAVING bal > 0
     )`, [storeId],
  );
  return { totalOwed: row?.owed ?? 0, customersWithBalance: row?.n ?? 0 };
}

/* -------------------------------- reports ------------------------------- */

export interface ReportSummary {
  totalSales: number;   // grand totals (incl. tax) in range
  transactions: number;
  itemsSold: number;    // net of returns
  grossProfit: number;  // net revenue (excl. tax) − cost snapshots, net of returns
  discountTotal: number;
  refundTotal: number;  // money refunded in range
}

export async function reportSummary(storeId: string, since: number): Promise<ReportSummary> {
  const db = getDb();
  const s = await db.getFirstAsync<{ total: number; txns: number; disc: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total, COUNT(*) AS txns, COALESCE(SUM(discount_total),0) AS disc
     FROM sales WHERE store_id=? AND status='completed' AND sold_at>=?`, [storeId, since],
  );
  const it = await db.getFirstAsync<{ items: number; profit: number }>(
    `SELECT COALESCE(SUM(si.quantity),0) AS items,
            COALESCE(SUM((si.line_total - si.tax) - si.unit_cost * si.quantity),0) AS profit
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at>=?`, [storeId, since],
  );
  // Returns net out items sold and profit, and total up refunds paid.
  const ret = await db.getFirstAsync<{ refund: number; items: number; profit: number }>(
    `SELECT COALESCE(SUM(ri.line_total),0) AS refund,
            COALESCE(SUM(ri.quantity),0) AS items,
            COALESCE(SUM((ri.line_total - ri.tax) - ri.unit_cost * ri.quantity),0) AS profit
     FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.store_id=? AND r.created_at>=?`, [storeId, since],
  );
  return {
    totalSales: s?.total ?? 0,
    transactions: s?.txns ?? 0,
    discountTotal: s?.disc ?? 0,
    refundTotal: ret?.refund ?? 0,
    itemsSold: (it?.items ?? 0) - (ret?.items ?? 0),
    grossProfit: (it?.profit ?? 0) - (ret?.profit ?? 0),
  };
}

export interface PaymentSlice { type: string; amount: number }

/** Amount tendered per method in range, plus a synthetic 'credit' slice for
 *  the unpaid balance of credit sales (which have no payment rows). */
export async function paymentBreakdown(storeId: string, since: number): Promise<PaymentSlice[]> {
  const db = getDb();
  const rows = await db.getAllAsync<PaymentSlice>(
    `SELECT p.type AS type, SUM(p.amount) AS amount
     FROM payments p JOIN sales s ON s.id = p.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at>=?
     GROUP BY p.type`, [storeId, since],
  );
  const paid = rows.reduce((n, r) => n + r.amount, 0);
  const totalRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total FROM sales WHERE store_id=? AND status='completed' AND sold_at>=?`,
    [storeId, since],
  );
  const credit = (totalRow?.total ?? 0) - paid;
  if (credit > 0) rows.push({ type: 'credit', amount: credit });
  return rows.sort((a, b) => b.amount - a.amount);
}

export interface BestSeller { name: string; qty: number; revenue: number }

export async function bestSellers(storeId: string, since: number, limit = 5): Promise<BestSeller[]> {
  return getDb().getAllAsync<BestSeller>(
    `SELECT si.product_name_snapshot AS name, SUM(si.quantity) AS qty, SUM(si.line_total) AS revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at>=?
     GROUP BY si.product_name_snapshot
     ORDER BY qty DESC LIMIT ?`, [storeId, since, limit],
  );
}

export interface LowStockItem { id: string; name: string; stock: number; threshold: number | null }

export async function lowStockProducts(storeId: string, limit = 20): Promise<LowStockItem[]> {
  return getDb().getAllAsync<LowStockItem>(
    `SELECT p.id, p.name, p.low_stock_threshold AS threshold,
            COALESCE((SELECT SUM(quantity_delta) FROM stock_movements sm WHERE sm.product_id = p.id), 0) AS stock
     FROM products p
     WHERE p.store_id=? AND p.active=1 AND p.deleted_at IS NULL AND p.track_inventory=1
       AND COALESCE((SELECT SUM(quantity_delta) FROM stock_movements sm WHERE sm.product_id = p.id), 0)
           <= COALESCE(p.low_stock_threshold, 5)
     ORDER BY stock ASC LIMIT ?`, [storeId, limit],
  );
}

/* ------------------------------- returns -------------------------------- */

export interface SaleHeader {
  id: string; invoice_no: string; customer_id: string | null;
  subtotal: number; discount_total: number; tax_total: number; grand_total: number;
  sold_at: number; status: string; payment_method: string;
  staff_name: string | null; // who rang up the sale, null on legacy/unlocked sales
}
export interface SaleItemRow {
  id: string; product_id: string | null; name: string;
  unit_price: number; unit_cost: number; quantity: number; tax: number; line_total: number;
  returned: number; // units already returned across prior returns
}
export interface SaleDetail { header: SaleHeader; items: SaleItemRow[]; refundedTotal: number }

export async function getSale(saleId: string): Promise<SaleDetail | null> {
  const db = getDb();
  const header = await db.getFirstAsync<SaleHeader>(
    `SELECT sales.id, invoice_no, customer_id, subtotal, discount_total, tax_total, grand_total, sold_at, status,
            COALESCE((SELECT type FROM payments WHERE sale_id = sales.id LIMIT 1), 'credit') AS payment_method,
            (SELECT name FROM staff WHERE staff.id = sales.staff_id) AS staff_name
     FROM sales WHERE sales.id = ?`, [saleId],
  );
  if (!header) return null;
  const items = await db.getAllAsync<SaleItemRow>(
    `SELECT si.id, si.product_id, si.product_name_snapshot AS name,
            si.unit_price, si.unit_cost, si.quantity, si.tax, si.line_total,
            COALESCE((SELECT SUM(ri.quantity) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS returned
     FROM sale_items si WHERE si.sale_id = ?`, [saleId],
  );
  const r = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total FROM returns WHERE sale_id = ?`, [saleId],
  );
  return { header, items, refundedTotal: r?.total ?? 0 };
}

export type RefundMethod = 'cash' | 'card' | 'bank' | 'account';
export interface ReturnPick { saleItemId: string; quantity: number }
export interface ReturnReceipt {
  saleInvoice: string; refundMethod: RefundMethod;
  lines: { name: string; quantity: number; lineTotal: Minor }[];
  subtotal: Minor; taxTotal: Minor; grandTotal: Minor; createdAt: number;
}

/**
 * Process a return atomically: writes returns + return_items, restores stock
 * via positive 'sale_return' movements, and for an "account" refund reduces the
 * customer's balance with a negative ledger entry. Refund amounts are prorated
 * from each original line's snapshot so partial returns stay exact.
 */
export async function processReturn(
  storeId: string, saleId: string, picks: ReturnPick[], refundMethod: RefundMethod, reason?: string,
): Promise<ReturnReceipt> {
  const db = getDb();
  const detail = await getSale(saleId);
  if (!detail) throw new Error('Sale not found');
  if (refundMethod === 'account' && !detail.header.customer_id) {
    throw new Error('This sale has no customer to refund to their account');
  }

  const now = Date.now();
  const returnId = newId();
  const rows: { pick: ReturnPick; item: SaleItemRow; refundLine: number; refundTax: number }[] = [];
  for (const pick of picks) {
    if (pick.quantity <= 0) continue;
    const item = detail.items.find((i) => i.id === pick.saleItemId);
    if (!item) throw new Error('Line not found on sale');
    const remaining = item.quantity - item.returned;
    if (pick.quantity > remaining) throw new Error(`Cannot return more than ${remaining} of ${item.name}`);
    // prorate from the original line snapshot so partial returns are exact
    const refundLine = roundHalfAwayFromZero((item.line_total * pick.quantity) / item.quantity);
    const refundTax = roundHalfAwayFromZero((item.tax * pick.quantity) / item.quantity);
    rows.push({ pick, item, refundLine, refundTax });
  }
  if (rows.length === 0) throw new Error('Select at least one item to return');

  const grandTotal = rows.reduce((n, r) => n + r.refundLine, 0);
  const taxTotal = rows.reduce((n, r) => n + r.refundTax, 0);
  const subtotal = grandTotal - taxTotal;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO returns (id,store_id,sale_id,customer_id,refund_method,subtotal,tax_total,grand_total,reason,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [returnId, storeId, saleId, detail.header.customer_id ?? null, refundMethod, subtotal, taxTotal, grandTotal, reason?.trim() || null, now, now, DEVICE_ID],
    );
    for (const { pick, item, refundLine, refundTax } of rows) {
      await db.runAsync(
        `INSERT INTO return_items (id,return_id,sale_item_id,product_id,product_name_snapshot,unit_cost,unit_price,quantity,tax,line_total,created_at,device_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [newId(), returnId, item.id, item.product_id, item.name, item.unit_cost, item.unit_price, pick.quantity, refundTax, refundLine, now, DEVICE_ID],
      );
      if (item.product_id) {
        await db.runAsync(
          `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
           VALUES (?,?,?,'sale_return',?, 'return', ?, ?, ?)`,
          [newId(), storeId, item.product_id, pick.quantity, returnId, now, DEVICE_ID],
        );
      }
    }
    if (refundMethod === 'account') {
      await db.runAsync(
        `INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,reference_id,created_at,device_id)
         VALUES (?,?,?,'refund',?, 'return', ?, ?, ?)`,
        [newId(), storeId, detail.header.customer_id, -grandTotal, returnId, now, DEVICE_ID],
      );
    }
  });

  return {
    saleInvoice: detail.header.invoice_no,
    refundMethod,
    lines: rows.map((r) => ({ name: r.item.name, quantity: r.pick.quantity, lineTotal: r.refundLine as Minor })),
    subtotal: subtotal as Minor, taxTotal: taxTotal as Minor, grandTotal: grandTotal as Minor, createdAt: now,
  };
}

/* ---------------------------- suppliers/purchases ----------------------- */

export interface Supplier {
  id: string; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null;
}

export async function listSuppliers(storeId: string): Promise<Supplier[]> {
  return getDb().getAllAsync<Supplier>(
    `SELECT id, name, phone, email, address, notes FROM suppliers
     WHERE store_id=? AND deleted_at IS NULL ORDER BY name`, [storeId],
  );
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  return (await getDb().getFirstAsync<Supplier>(
    `SELECT id, name, phone, email, address, notes FROM suppliers WHERE id=?`, [id])) ?? null;
}

export async function createSupplier(input: {
  storeId: string; name: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null;
}): Promise<string> {
  const id = newId();
  const now = Date.now();
  await getDb().runAsync(
    `INSERT INTO suppliers (id,store_id,name,phone,email,address,notes,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
    [id, input.storeId, input.name.trim(), input.phone?.trim() || null, input.email?.trim() || null, input.address?.trim() || null, input.notes?.trim() || null, now, now, DEVICE_ID],
  );
  return id;
}

export interface PurchaseLine { productId: string; name: string; quantity: number; unitCost: Minor }
export interface PurchaseReceipt { referenceNo: string; total: Minor; itemCount: number }

/**
 * Receive a purchase atomically: writes purchases + purchase_items, restocks
 * each product with a positive 'purchase' movement, and updates the product's
 * cost_price to the latest cost (past sale snapshots are untouched).
 */
export async function createPurchase(
  storeId: string, supplierId: string | null, lines: PurchaseLine[], note?: string,
): Promise<PurchaseReceipt> {
  const valid = lines.filter((l) => l.quantity > 0);
  if (valid.length === 0) throw new Error('Add at least one item to the purchase');
  const db = getDb();
  const now = Date.now();
  const purchaseId = newId();
  const total = valid.reduce((n, l) => n + l.unitCost * l.quantity, 0);
  const countRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM purchases');
  const referenceNo = `PO-${String((countRow?.c ?? 0) + 1).padStart(4, '0')}`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO purchases (id,store_id,supplier_id,reference_no,total,note,status,purchased_at,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?, 'received', ?,?,?,?,1)`,
      [purchaseId, storeId, supplierId, referenceNo, total, note?.trim() || null, now, now, now, DEVICE_ID],
    );
    for (const l of valid) {
      await db.runAsync(
        `INSERT INTO purchase_items (id,purchase_id,product_id,product_name_snapshot,unit_cost,quantity,line_total,created_at,device_id)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [newId(), purchaseId, l.productId, l.name, l.unitCost, l.quantity, l.unitCost * l.quantity, now, DEVICE_ID],
      );
      await db.runAsync(
        `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
         VALUES (?,?,?,'purchase',?, 'purchase', ?, ?, ?)`,
        [newId(), storeId, l.productId, l.quantity, purchaseId, now, DEVICE_ID],
      );
      await db.runAsync(
        `UPDATE products SET cost_price=?, updated_at=?, version=version+1 WHERE id=?`,
        [l.unitCost, now, l.productId],
      );
    }
  });

  return { referenceNo, total: total as Minor, itemCount: valid.length };
}

export interface PurchaseSummary {
  id: string; reference_no: string; supplier_name: string | null; total: number; purchased_at: number; item_count: number;
}

export async function listPurchases(storeId: string, limit = 50): Promise<PurchaseSummary[]> {
  return getDb().getAllAsync<PurchaseSummary>(
    `SELECT p.id, p.reference_no, s.name AS supplier_name, p.total, p.purchased_at,
            (SELECT COALESCE(SUM(quantity),0) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS item_count
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.store_id=? AND p.status='received'
     ORDER BY p.purchased_at DESC LIMIT ?`, [storeId, limit],
  );
}

/* ------------------------------ csv backup ------------------------------ */

/** Update editable product fields (used by CSV import for existing products). */
export async function updateProductFields(input: {
  id: string; name: string; sellingPrice: Minor; costPrice: Minor; taxBps: number; barcode?: string | null;
  // Optional: omitted keys are left untouched (CSV import only sets the basics).
  sku?: string | null; unit?: string | null; categoryId?: string | null; lowStockThreshold?: number | null; imageUri?: string | null;
}): Promise<void> {
  const sets = ['name=?', 'selling_price=?', 'cost_price=?', 'tax_bps=?', 'barcode=?'];
  const args: (string | number | null)[] = [input.name.trim(), input.sellingPrice, input.costPrice, input.taxBps, input.barcode?.trim() || null];
  const opt = (col: string, key: keyof typeof input, val: string | number | null) => {
    if (input[key] !== undefined) { sets.push(`${col}=?`); args.push(val); }
  };
  opt('sku', 'sku', input.sku?.trim() || null);
  opt('unit', 'unit', input.unit?.trim() || 'unit');
  opt('category_id', 'categoryId', input.categoryId ?? null);
  opt('low_stock_threshold', 'lowStockThreshold', input.lowStockThreshold ?? null);
  opt('image_uri', 'imageUri', input.imageUri ?? null);
  await getDb().runAsync(
    `UPDATE products SET ${sets.join(', ')}, updated_at=?, version=version+1 WHERE id=?`,
    [...args, Date.now(), input.id],
  );
}

export async function getProduct(id: string): Promise<Product | null> {
  return (await getDb().getFirstAsync<Product>(`${PRODUCT_SELECT} WHERE p.id = ?`, [id])) ?? null;
}

/** Soft-delete a product: it leaves the catalog (active=0, deleted_at set) but
 * past sales keep their snapshotted name/price, so history is never broken. The
 * tombstone syncs like any other change. */
export async function deleteProduct(id: string): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `UPDATE products SET active=0, deleted_at=?, updated_at=?, version=version+1 WHERE id=?`,
    [now, now, id],
  );
}

export interface SalesExportRow {
  invoice_no: string; sold_at: number; product: string; quantity: number;
  unit_price: number; line_total: number; grand_total: number;
}

export async function salesExportRows(storeId: string): Promise<SalesExportRow[]> {
  return getDb().getAllAsync<SalesExportRow>(
    `SELECT s.invoice_no, s.sold_at, si.product_name_snapshot AS product, si.quantity,
            si.unit_price, si.line_total, s.grand_total
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed'
     ORDER BY s.sold_at DESC, si.rowid`, [storeId],
  );
}

/* -------------------------------- staff --------------------------------- */

export interface Staff {
  id: string;
  name: string;
  role: Role;
  created_at: number;
}

/** Active (non-deleted) staff for the store, owners first. */
export async function listStaff(storeId: string): Promise<Staff[]> {
  return getDb().getAllAsync<Staff>(
    `SELECT id, name, role, created_at FROM staff
     WHERE store_id=? AND active=1 AND deleted_at IS NULL
     ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, name`,
    [storeId],
  );
}

export async function staffCount(storeId: string): Promise<number> {
  const row = await getDb().getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM staff WHERE store_id=? AND active=1 AND deleted_at IS NULL`, [storeId],
  );
  return row?.c ?? 0;
}

export async function createStaff(input: {
  storeId: string; name: string; role: Role; pin: string;
}): Promise<string> {
  const id = newId();
  const now = Date.now();
  const salt = randomSalt();
  await getDb().runAsync(
    `INSERT INTO staff (id,store_id,name,role,pin_salt,pin_hash,active,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,1,?,?,?,1)`,
    [id, input.storeId, input.name.trim(), input.role, salt, hashPin(input.pin, salt), now, now, DEVICE_ID],
  );
  return id;
}

export async function updateStaff(input: {
  id: string; name: string; role: Role; pin?: string;
}): Promise<void> {
  const now = Date.now();
  if (input.pin) {
    const salt = randomSalt();
    await getDb().runAsync(
      `UPDATE staff SET name=?, role=?, pin_salt=?, pin_hash=?, updated_at=?, version=version+1 WHERE id=?`,
      [input.name.trim(), input.role, salt, hashPin(input.pin, salt), now, input.id],
    );
  } else {
    await getDb().runAsync(
      `UPDATE staff SET name=?, role=?, updated_at=?, version=version+1 WHERE id=?`,
      [input.name.trim(), input.role, now, input.id],
    );
  }
}

/** Soft-delete a staff member. Refuses to remove the last remaining owner. */
export async function deleteStaff(storeId: string, id: string): Promise<void> {
  const target = await getDb().getFirstAsync<{ role: Role }>(`SELECT role FROM staff WHERE id=?`, [id]);
  if (target?.role === 'owner') {
    const owners = await getDb().getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM staff WHERE store_id=? AND role='owner' AND active=1 AND deleted_at IS NULL`, [storeId],
    );
    if ((owners?.c ?? 0) <= 1) throw new Error('Cannot remove the last owner');
  }
  await getDb().runAsync(
    `UPDATE staff SET active=0, deleted_at=?, updated_at=?, version=version+1 WHERE id=?`,
    [Date.now(), Date.now(), id],
  );
}

/** Verify a staff PIN. Returns the staff on success, null otherwise. */
export async function authenticateStaff(id: string, pin: string): Promise<Staff | null> {
  const row = await getDb().getFirstAsync<{ id: string; name: string; role: Role; created_at: number; pin_salt: string; pin_hash: string }>(
    `SELECT id, name, role, created_at, pin_salt, pin_hash FROM staff
     WHERE id=? AND active=1 AND deleted_at IS NULL`, [id],
  );
  if (!row) return null;
  if (!verifyPin(pin, row.pin_salt, row.pin_hash)) return null;
  return { id: row.id, name: row.name, role: row.role, created_at: row.created_at };
}
