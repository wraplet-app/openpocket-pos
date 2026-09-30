/**
 * Demo seed — builds a complete sample store so a fresh clone has something to
 * explore in one tap. Dev-only (wired to a button on the onboarding screen when
 * __DEV__). Runs entirely through the real repos, so stock, credit ledger and
 * reports all stay consistent.
 *
 * The catalog is 24 real products (real barcodes, real front-of-pack photos
 * bundled in assets/demo — see assets/demo/ATTRIBUTION.md), grouped into
 * categories with SKUs, units and low-stock levels. The shop itself comes with
 * a full profile (logo, contact details, tax id) and a customised receipt.
 *
 * Owner PIN 1234 · Cashier PIN 5678. Demo shop is a US-style market (USD).
 */
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { computeCart, fromMajorString, asMinor, asBps, type Minor } from '@openpocket/pos-core';
import {
  getStore, createStore, createProduct, listProducts, createCustomer, createStaff, ensureCategory,
  checkoutSale, recordCustomerPayment, type Product, type CheckoutLine, type PaymentMethod,
} from './repos';
import { DEMO_IMAGES, DEMO_LOGO } from './demoAssets';

const DEC = 2;
const M = (major: string) => fromMajorString(major, DEC);

interface DemoProduct {
  name: string; slug: keyof typeof DEMO_IMAGES; barcode: string; category: string; unit: string;
  sell: string; cost: string; tax: number; stock: number; low?: number;
}

const CAT = { bev: 'Beverages', snack: 'Snacks & Sweets', pantry: 'Pantry', care: 'Personal Care' } as const;

// Internationally recognisable products with real barcodes. Prices are typical
// US shelf prices; tax is a flat 8% sales tax on taxable goods, 0% on staples.
const PRODUCTS: DemoProduct[] = [
  { name: 'Coca-Cola 500ml', slug: 'coca-cola', barcode: '5449000000996', category: CAT.bev, unit: 'pcs', sell: '1.99', cost: '1.35', tax: 8, stock: 60, low: 12 },
  { name: 'Pepsi 500ml', slug: 'pepsi', barcode: '4062139017355', category: CAT.bev, unit: 'pcs', sell: '1.99', cost: '1.35', tax: 8, stock: 55, low: 12 },
  { name: 'Sprite 500ml', slug: 'sprite', barcode: '5000112658149', category: CAT.bev, unit: 'pcs', sell: '1.99', cost: '1.35', tax: 8, stock: 45, low: 12 },
  { name: 'Fanta Orange 330ml', slug: 'fanta', barcode: '5449000011527', category: CAT.bev, unit: 'pcs', sell: '1.49', cost: '1.00', tax: 8, stock: 40, low: 10 },
  { name: 'Evian Natural Water 500ml', slug: 'evian', barcode: '3068320055008', category: CAT.bev, unit: 'pcs', sell: '1.79', cost: '1.10', tax: 0, stock: 50, low: 12 },
  { name: 'Red Bull Energy Drink 250ml', slug: 'red-bull', barcode: '90162602', category: CAT.bev, unit: 'pcs', sell: '2.99', cost: '2.05', tax: 8, stock: 36, low: 8 },
  { name: 'Tropicana Orange Juice', slug: 'tropicana', barcode: '5022313729824', category: CAT.bev, unit: 'pcs', sell: '4.49', cost: '3.20', tax: 0, stock: 24, low: 6 },
  { name: 'Nescafé Classic 100g', slug: 'nescafe', barcode: '6111018903161', category: CAT.bev, unit: 'pcs', sell: '9.99', cost: '7.40', tax: 0, stock: 18, low: 4 },

  { name: "Lay's Classic Potato Chips", slug: 'lays', barcode: '0028400199148', category: CAT.snack, unit: 'pack', sell: '4.29', cost: '2.90', tax: 8, stock: 40, low: 8 },
  { name: 'Pringles Original', slug: 'pringles', barcode: '5053990156009', category: CAT.snack, unit: 'pcs', sell: '2.79', cost: '1.85', tax: 8, stock: 48, low: 10 },
  { name: 'Oreo Original Cookies', slug: 'oreo', barcode: '7622300336738', category: CAT.snack, unit: 'pack', sell: '4.99', cost: '3.40', tax: 8, stock: 34, low: 8 },
  { name: 'Cadbury Dairy Milk 100g', slug: 'dairy-milk', barcode: '7622201148782', category: CAT.snack, unit: 'pcs', sell: '2.49', cost: '1.60', tax: 8, stock: 30, low: 8 },
  { name: 'KitKat 4 Finger', slug: 'kitkat', barcode: '7613035220065', category: CAT.snack, unit: 'pcs', sell: '1.79', cost: '1.10', tax: 8, stock: 4, low: 6 },
  { name: 'Snickers 3-Pack', slug: 'snickers', barcode: '5000159560061', category: CAT.snack, unit: 'pack', sell: '2.99', cost: '1.90', tax: 8, stock: 60, low: 12 },
  { name: "M&M's Peanut Sharing Bag", slug: 'mms', barcode: '5000159492737', category: CAT.snack, unit: 'pack', sell: '5.49', cost: '3.90', tax: 8, stock: 28, low: 6 },

  { name: "Kellogg's Corn Flakes", slug: 'corn-flakes', barcode: '5059319030517', category: CAT.pantry, unit: 'box', sell: '4.99', cost: '3.50', tax: 0, stock: 26, low: 6 },
  { name: 'Barilla Spaghetti No. 5', slug: 'spaghetti', barcode: '8076800195057', category: CAT.pantry, unit: 'pack', sell: '2.49', cost: '1.55', tax: 0, stock: 44, low: 10 },
  { name: 'Heinz Baked Beans', slug: 'baked-beans', barcode: '5000157024671', category: CAT.pantry, unit: 'pcs', sell: '1.99', cost: '1.25', tax: 0, stock: 0, low: 8 },
  { name: 'Nutella Hazelnut Spread', slug: 'nutella', barcode: '3017620422003', category: CAT.pantry, unit: 'pcs', sell: '4.99', cost: '3.60', tax: 0, stock: 22, low: 5 },
  { name: 'Quaker Porridge Oats', slug: 'quaker-oats', barcode: '5000108022152', category: CAT.pantry, unit: 'box', sell: '4.29', cost: '3.00', tax: 0, stock: 20, low: 5 },

  { name: 'Colgate Triple Action Toothpaste', slug: 'colgate', barcode: '6920354812521', category: CAT.care, unit: 'pcs', sell: '3.49', cost: '2.20', tax: 8, stock: 32, low: 8 },
  { name: 'Nivea Creme 150ml', slug: 'nivea', barcode: '4005800001192', category: CAT.care, unit: 'pcs', sell: '5.99', cost: '4.10', tax: 8, stock: 15, low: 4 },
  { name: 'Head & Shoulders Classic 400ml', slug: 'head-shoulders', barcode: '8700216156004', category: CAT.care, unit: 'pcs', sell: '7.99', cost: '5.60', tax: 8, stock: 18, low: 4 },
  { name: 'Dove Beauty Cream Bar', slug: 'dove', barcode: '8720182264664', category: CAT.care, unit: 'pcs', sell: '1.99', cost: '1.20', tax: 8, stock: 40, low: 8 },
];

/** Copy a bundled asset into the app's document folder so it behaves like a user-picked image. */
async function installAsset(mod: number, dir: string, filename: string): Promise<string | null> {
  try {
    const asset = Asset.fromModule(mod);
    await asset.downloadAsync();
    const from = asset.localUri ?? asset.uri;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const dest = `${dir}${filename}`;
    await FileSystem.copyAsync({ from, to: dest });
    return dest;
  } catch {
    return null; // a missing photo must never block the demo
  }
}

export async function seedDemoData(): Promise<{ store: string; products: number; sales: number; customers: number; staff: number }> {
  if (await getStore()) throw new Error('A store already exists on this device');

  const docs = FileSystem.documentDirectory ?? '';
  const logoUri = await installAsset(DEMO_LOGO, `${docs}branding/`, 'demo-logo.png');

  const store = await createStore('Maple Street Market', { code: 'USD', locale: 'en-US', decimals: DEC }, {
    tagline: 'Fresh finds, fair prices',
    address: '48 Maple Street, Springfield, IL 62704',
    phone: '+1 (555) 010-2030',
    email: 'hello@maplestreetmarket.com',
    website: 'www.maplestreetmarket.com',
    taxId: 'Tax ID 12-3456789',
    logoUri,
    receiptFooter: 'Thank you for shopping with us!\nSee you again soon.',
    receiptTerms: 'Items can be returned within 14 days with this receipt. Perishable goods are non-returnable.',
    receiptAccent: '#0ca678',
    receiptPaper: 'a4',
  });

  const categoryIds: Record<string, string> = {};
  for (const name of Object.values(CAT)) categoryIds[name] = await ensureCategory(store.id, name);

  let n = 0;
  for (const p of PRODUCTS) {
    n++;
    const imageUri = await installAsset(DEMO_IMAGES[p.slug]!, `${docs}products/`, `demo-${p.slug}.jpg`);
    await createProduct({
      storeId: store.id, name: p.name, barcode: p.barcode, imageUri,
      sku: `${p.category.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${String(n).padStart(3, '0')}`,
      unit: p.unit, categoryId: categoryIds[p.category]!, lowStockThreshold: p.low ?? null,
      sellingPrice: M(p.sell), costPrice: M(p.cost), taxBps: Math.round(p.tax * 100), openingStock: p.stock,
    });
  }

  await createStaff({ storeId: store.id, name: 'Alex', role: 'owner', pin: '1234' });
  const cashier = await createStaff({ storeId: store.id, name: 'Sam', role: 'cashier', pin: '5678' });

  const emma = await createCustomer({ storeId: store.id, name: 'Emma Johnson', phone: '+1 555 010 4477' });
  const liam = await createCustomer({ storeId: store.id, name: 'Liam Carter', phone: '+1 555 010 2291' });
  const olivia = await createCustomer({ storeId: store.id, name: 'Olivia Brown', phone: '+1 555 010 8830' });

  const products = await listProducts(store.id);
  const by = (n: string) => products.find((p) => p.name.toLowerCase().startsWith(n.toLowerCase()));
  const line = (p: Product | undefined, q: number): CheckoutLine[] => (p ? [{ product: p, quantity: q }] : []);

  const sales: { lines: CheckoutLine[]; method: PaymentMethod; customerId?: string }[] = [
    { lines: [...line(by('Coca'), 2), ...line(by("Lay's"), 1)], method: 'cash' },
    { lines: [...line(by('Cadbury'), 1), ...line(by('Nescaf'), 1)], method: 'card', customerId: emma },
    { lines: [...line(by('Tropicana'), 1), ...line(by("Kellogg's"), 1)], method: 'credit', customerId: liam },
    { lines: [...line(by('Sprite'), 3)], method: 'cash' },
    { lines: [...line(by('Colgate'), 1), ...line(by('Barilla'), 2)], method: 'credit', customerId: olivia },
    { lines: [...line(by('Evian'), 2), ...line(by('Oreo'), 2)], method: 'cash' },
  ];

  let done = 0;
  for (const sale of sales) {
    if (sale.lines.length === 0) continue;
    const totals = computeCart(sale.lines.map((l) => ({
      unitPrice: asMinor(l.product.selling_price), quantity: l.quantity, taxBps: asBps(l.product.tax_bps),
    })));
    await checkoutSale(store.id, sale.lines, {
      paymentMethod: sale.method, received: totals.grandTotal,
      customerId: sale.customerId ?? null, staffId: cashier,
    });
    done++;
  }

  // Liam pays down part of his credit ($2.00).
  await recordCustomerPayment(store.id, liam, asMinor(200) as Minor);

  return { store: store.name, products: PRODUCTS.length, sales: done, customers: 3, staff: 2 };
}
