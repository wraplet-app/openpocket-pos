import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { toCsv, parseCsv, fromMajorString, asMinor } from '@openpocket/pos-core';
import {
  listProducts, salesExportRows, findProductByBarcode, createProduct, updateProductFields,
} from './repos';
import type { Store } from './repos';
import { getDb } from './db';

const major = (minor: number, dec: number) => (minor / 10 ** dec).toFixed(dec);
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

async function writeAndShare(filename: string, csv: string): Promise<void> {
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
  }
}

export async function exportProducts(store: Store): Promise<number> {
  const dec = store.currency_decimals;
  const products = await listProducts(store.id);
  const rows = products.map((p) => [
    p.name, p.barcode ?? '', major(p.selling_price, dec), major(p.cost_price, dec), String(p.tax_bps / 100), String(p.stock),
  ]);
  const csv = toCsv(['name', 'barcode', 'selling_price', 'cost_price', 'tax_percent', 'stock'], rows);
  await writeAndShare(`products-${stamp()}.csv`, csv);
  return products.length;
}

export async function exportSales(store: Store): Promise<number> {
  const dec = store.currency_decimals;
  const rows = await salesExportRows(store.id);
  const body = rows.map((r) => [
    r.invoice_no, new Date(r.sold_at).toISOString(), r.product, String(r.quantity),
    major(r.unit_price, dec), major(r.line_total, dec), major(r.grand_total, dec),
  ]);
  const csv = toCsv(['invoice', 'date', 'product', 'quantity', 'unit_price', 'line_total', 'sale_total'], body);
  await writeAndShare(`sales-${stamp()}.csv`, csv);
  return rows.length;
}

/* -------------------- full-database backup & restore -------------------- */

// Every user table except the migration ledger (that belongs to the install,
// not the data, and forcing it could re-run migrations against existing tables).
const TABLES_SQL = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_migrations','sync_state') ORDER BY name`;
const BACKUP_MAGIC = 'openpocketpos';

/** Snapshot the whole database to a JSON file and open the share sheet. */
export async function exportFullBackup(store: Store): Promise<number> {
  const db = getDb();
  const tables = (await db.getAllAsync<{ name: string }>(TABLES_SQL)).map((r) => r.name);
  const data: Record<string, unknown[]> = {};
  let rows = 0;
  for (const tbl of tables) {
    const list = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM "${tbl}"`);
    data[tbl] = list;
    rows += list.length;
  }
  const payload = { app: BACKUP_MAGIC, schema: 1, exported_at: Date.now(), store: store.name, tables: data };
  const filename = `openpocket-backup-${stamp()}.json`;
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: filename, UTI: 'public.json' });
  }
  return rows;
}

export interface RestoreResult { tables: number; rows: number }

/** Pick a backup file and replace all data with it. Destructive; caller confirms. */
export async function restoreFullBackup(): Promise<RestoreResult | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  let payload: { app?: string; tables?: Record<string, Record<string, unknown>[]> };
  try { payload = JSON.parse(text); } catch { throw new Error('That file is not valid JSON'); }
  if (payload?.app !== BACKUP_MAGIC || !payload.tables) throw new Error('Not an OpenPocket backup file');

  const db = getDb();
  const tableNames = Object.keys(payload.tables);
  let rows = 0;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const tbl of tableNames) await db.runAsync(`DELETE FROM "${tbl}"`);
      for (const tbl of tableNames) {
        for (const row of payload.tables![tbl]!) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const colList = cols.map((c) => `"${c}"`).join(',');
          const params = cols.map((c) => row[c] as string | number | null);
          await db.runAsync(`INSERT INTO "${tbl}" (${colList}) VALUES (${cols.map(() => '?').join(',')})`, params);
          rows++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return { tables: tableNames.length, rows };
}

export interface ImportResult { created: number; updated: number; skipped: number }

const ALIASES: Record<string, string[]> = {
  name: ['name', 'product', 'title'],
  barcode: ['barcode', 'code', 'sku'],
  selling_price: ['selling_price', 'price', 'sell', 'selling'],
  cost_price: ['cost_price', 'cost', 'buy'],
  tax_percent: ['tax_percent', 'tax', 'tax%'],
  stock: ['stock', 'quantity', 'qty', 'opening_stock'],
};

function columnIndex(headers: string[], field: keyof typeof ALIASES): number {
  const hs = headers.map((h) => h.trim().toLowerCase());
  for (const a of ALIASES[field]!) { const i = hs.indexOf(a); if (i >= 0) return i; }
  return -1;
}

/** Pick a CSV file and upsert products. Match by barcode; otherwise create. */
export async function importProducts(store: Store): Promise<ImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  const rows = parseCsv(text);
  if (rows.length < 2) return { created: 0, updated: 0, skipped: 0 };

  const headers = rows[0]!;
  const iName = columnIndex(headers, 'name');
  const iBarcode = columnIndex(headers, 'barcode');
  const iSell = columnIndex(headers, 'selling_price');
  const iCost = columnIndex(headers, 'cost_price');
  const iTax = columnIndex(headers, 'tax_percent');
  const iStock = columnIndex(headers, 'stock');
  if (iName < 0 || iSell < 0) throw new Error('CSV needs at least "name" and "selling_price" columns');

  const dec = store.currency_decimals;
  let created = 0, updated = 0, skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const name = (row[iName] ?? '').trim();
    const barcode = iBarcode >= 0 ? (row[iBarcode] ?? '').trim() : '';
    try {
      if (!name) { skipped++; continue; }
      const sellingPrice = fromMajorString(row[iSell]?.trim() || '0', dec);
      if (sellingPrice <= 0) { skipped++; continue; }
      const costPrice = iCost >= 0 ? fromMajorString(row[iCost]?.trim() || '0', dec) : asMinor(0);
      const taxBps = iTax >= 0 ? Math.max(0, Math.round((parseFloat(row[iTax]?.trim() || '0') || 0) * 100)) : 0;
      const openingStock = iStock >= 0 ? Math.max(0, Math.floor(parseFloat(row[iStock]?.trim() || '0') || 0)) : 0;

      const existing = barcode ? await findProductByBarcode(store.id, barcode) : null;
      if (existing) {
        await updateProductFields({ id: existing.id, name, sellingPrice, costPrice, taxBps, barcode });
        updated++;
      } else {
        await createProduct({ storeId: store.id, name, barcode: barcode || null, imageUri: null, sellingPrice, costPrice, taxBps, openingStock });
        created++;
      }
    } catch { skipped++; }
  }
  return { created, updated, skipped };
}
