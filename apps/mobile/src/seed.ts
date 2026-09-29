/**
 * Demo seed — builds a complete sample store so a fresh clone has something to
 * explore in one tap. Dev-only (wired to a button on the onboarding screen when
 * __DEV__). Runs entirely through the real repos, so stock, credit ledger and
 * reports all stay consistent.
 *
 * Owner PIN 1234 · Cashier PIN 5678.
 */
import { computeCart, fromMajorString, asMinor, asBps, type Minor } from '@openpocket/pos-core';
import {
  getStore, createStore, createProduct, listProducts, createCustomer, createStaff,
  checkoutSale, recordCustomerPayment, type Product, type CheckoutLine, type PaymentMethod,
} from './repos';

const DEC = 2;
const M = (major: string) => fromMajorString(major, DEC);

const PRODUCTS = [
  { name: 'Coca-Cola 500ml', barcode: '5449000000996', sell: '50', cost: '38', tax: 0, stock: 60 },
  { name: 'Colgate 100g', barcode: '8901314010112', sell: '180', cost: '150', tax: 17, stock: 20 },
  { name: 'Dairy Milk', barcode: '7622300336738', sell: '120', cost: '95', tax: 5, stock: 30 },
  { name: 'Lays Chips', barcode: '5449000131805', sell: '30', cost: '22', tax: 5, stock: 80 },
  { name: 'Nestle Water 1.5L', barcode: '6291041500213', sell: '60', cost: '45', tax: 0, stock: 50 },
  { name: 'Shan Masala', barcode: '4800024531001', sell: '90', cost: '70', tax: 5, stock: 40 },
  { name: 'Sooper Biscuits', barcode: '5901234123457', sell: '40', cost: '30', tax: 5, stock: 100 },
  { name: 'Sprite 500ml', barcode: '5449000054227', sell: '50', cost: '38', tax: 0, stock: 45 },
  { name: 'Sunflower Oil 1L', barcode: '8964000234563', sell: '420', cost: '360', tax: 0, stock: 25 },
  { name: 'Tapal Tea 250g', barcode: '8964000512019', sell: '260', cost: '210', tax: 5, stock: 35 },
];

export async function seedDemoData(): Promise<{ store: string; products: number; sales: number; customers: number; staff: number }> {
  if (await getStore()) throw new Error('A store already exists on this device');

  const store = await createStore('Bin Hashim', { code: 'PKR', locale: 'en-PK', decimals: DEC });

  for (const p of PRODUCTS) {
    await createProduct({
      storeId: store.id, name: p.name, barcode: p.barcode, imageUri: null,
      sellingPrice: M(p.sell), costPrice: M(p.cost), taxBps: Math.round(p.tax * 100), openingStock: p.stock,
    });
  }

  await createStaff({ storeId: store.id, name: 'Kashif', role: 'owner', pin: '1234' });
  const cashier = await createStaff({ storeId: store.id, name: 'Sara', role: 'cashier', pin: '5678' });

  const ahmed = await createCustomer({ storeId: store.id, name: 'Ahmed Raza', phone: '03001234567' });
  const sara = await createCustomer({ storeId: store.id, name: 'Sara Malik', phone: '03007654321' });
  const bilal = await createCustomer({ storeId: store.id, name: 'Bilal Khan', phone: '03119998888' });

  const products = await listProducts(store.id);
  const by = (n: string) => products.find((p) => p.name.toLowerCase().startsWith(n.toLowerCase()));
  const line = (p: Product | undefined, q: number): CheckoutLine[] => (p ? [{ product: p, quantity: q }] : []);

  const sales: { lines: CheckoutLine[]; method: PaymentMethod; customerId?: string }[] = [
    { lines: [...line(by('Coca'), 2), ...line(by('Lays'), 1)], method: 'cash' },
    { lines: [...line(by('Dairy'), 1), ...line(by('Tapal'), 1)], method: 'card', customerId: ahmed },
    { lines: [...line(by('Sunflower'), 1)], method: 'credit', customerId: sara },
    { lines: [...line(by('Sprite'), 3)], method: 'cash' },
    { lines: [...line(by('Colgate'), 1), ...line(by('Shan'), 2)], method: 'credit', customerId: bilal },
    { lines: [...line(by('Nestle'), 2), ...line(by('Sooper'), 4)], method: 'cash' },
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

  // Sara pays down part of her credit.
  await recordCustomerPayment(store.id, sara, asMinor(20000) as Minor); // Rs 200

  return { store: store.name, products: PRODUCTS.length, sales: done, customers: 3, staff: 2 };
}
