/**
 * Sync metadata + portable SQL, shared by the mobile app (expo-sqlite) and the
 * Cloudflare Worker (D1). Both speak SQLite with `?` placeholders, so the same
 * strings run on either side.
 *
 * Two row kinds:
 *  - 'mutable'  rows carry updated_at + version → last-writer-wins on upsert.
 *  - 'append'   rows (events/ledger lines) are immutable → insert-if-absent by id.
 *
 * A device holds exactly one store, so on PULL we scope every table to the
 * token's store: directly by store_id, by id for the stores row itself, or via
 * the parent for child tables that have no store_id column.
 */

export type SyncMode = 'mutable' | 'append';

export type StoreScope =
  | { kind: 'self' }                                  // the stores row: id = storeId
  | { kind: 'column' }                                // has its own store_id column
  | { kind: 'parent'; table: string; fk: string };    // scope through a parent row

export interface SyncTable {
  name: string;
  mode: SyncMode;
  timeColumn: 'updated_at' | 'created_at';
  columns: string[];
  scope: StoreScope;
}

// Ordered parents-before-children so a straight replay satisfies foreign keys.
export const SYNC_TABLES: readonly SyncTable[] = [
  {
    name: 'stores', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'self' },
    columns: ['id', 'name', 'currency_code', 'currency_locale', 'currency_decimals', 'address', 'phone', 'created_at', 'updated_at', 'device_id', 'version'],
  },
  {
    name: 'categories', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'name', 'sort_order', 'created_at', 'updated_at', 'device_id', 'version'],
  },
  {
    name: 'suppliers', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'name', 'phone', 'email', 'address', 'notes', 'created_at', 'updated_at', 'deleted_at', 'device_id', 'version'],
  },
  {
    name: 'staff', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'name', 'role', 'pin_salt', 'pin_hash', 'active', 'created_at', 'updated_at', 'deleted_at', 'device_id', 'version'],
  },
  {
    name: 'customers', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'name', 'phone', 'email', 'address', 'notes', 'created_at', 'updated_at', 'deleted_at', 'device_id', 'version'],
  },
  {
    name: 'products', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'category_id', 'name', 'sku', 'barcode', 'cost_price', 'selling_price', 'unit', 'track_inventory', 'low_stock_threshold', 'tax_bps', 'image_uri', 'active', 'created_at', 'updated_at', 'deleted_at', 'device_id', 'version'],
  },
  {
    name: 'sales', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'invoice_no', 'customer_id', 'cashier_id', 'staff_id', 'status', 'subtotal', 'discount_total', 'tax_total', 'grand_total', 'note', 'sold_at', 'created_at', 'updated_at', 'device_id', 'version'],
  },
  {
    name: 'sale_items', mode: 'append', timeColumn: 'created_at', scope: { kind: 'parent', table: 'sales', fk: 'sale_id' },
    columns: ['id', 'sale_id', 'product_id', 'product_name_snapshot', 'sku_snapshot', 'unit_cost', 'unit_price', 'quantity', 'discount', 'tax', 'line_total', 'created_at', 'device_id'],
  },
  {
    name: 'payments', mode: 'append', timeColumn: 'created_at', scope: { kind: 'parent', table: 'sales', fk: 'sale_id' },
    columns: ['id', 'sale_id', 'type', 'display_name', 'amount', 'created_at', 'device_id'],
  },
  {
    name: 'stock_movements', mode: 'append', timeColumn: 'created_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'product_id', 'type', 'quantity_delta', 'reference_type', 'reference_id', 'note', 'created_at', 'device_id'],
  },
  {
    name: 'customer_ledger', mode: 'append', timeColumn: 'created_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'customer_id', 'type', 'amount', 'reference_type', 'reference_id', 'note', 'created_at', 'device_id'],
  },
  {
    name: 'returns', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'sale_id', 'customer_id', 'refund_method', 'subtotal', 'tax_total', 'grand_total', 'reason', 'created_at', 'updated_at', 'device_id', 'version'],
  },
  {
    name: 'return_items', mode: 'append', timeColumn: 'created_at', scope: { kind: 'parent', table: 'returns', fk: 'return_id' },
    columns: ['id', 'return_id', 'sale_item_id', 'product_id', 'product_name_snapshot', 'unit_cost', 'unit_price', 'quantity', 'tax', 'line_total', 'created_at', 'device_id'],
  },
  {
    name: 'purchases', mode: 'mutable', timeColumn: 'updated_at', scope: { kind: 'column' },
    columns: ['id', 'store_id', 'supplier_id', 'reference_no', 'total', 'note', 'status', 'purchased_at', 'created_at', 'updated_at', 'device_id', 'version'],
  },
  {
    name: 'purchase_items', mode: 'append', timeColumn: 'created_at', scope: { kind: 'parent', table: 'purchases', fk: 'purchase_id' },
    columns: ['id', 'purchase_id', 'product_id', 'product_name_snapshot', 'unit_cost', 'quantity', 'line_total', 'created_at', 'device_id'],
  },
];

const q = (id: string) => `"${id}"`;

/**
 * Upsert one row. Mutable tables overwrite only when the incoming row is newer
 * (updated_at, then version) — otherwise the existing row wins. Append tables
 * never overwrite (immutable), so a replayed event is a no-op.
 */
export function upsertSql(t: SyncTable): string {
  const cols = t.columns.map(q).join(', ');
  const ph = t.columns.map(() => '?').join(', ');
  if (t.mode === 'append') {
    return `INSERT INTO ${q(t.name)} (${cols}) VALUES (${ph}) ON CONFLICT(id) DO NOTHING`;
  }
  const setCols = t.columns.filter((c) => c !== 'id').map((c) => `${q(c)}=excluded.${q(c)}`).join(', ');
  return `INSERT INTO ${q(t.name)} (${cols}) VALUES (${ph}) ON CONFLICT(id) DO UPDATE SET ${setCols} ` +
    `WHERE excluded."updated_at" > ${q(t.name)}."updated_at" ` +
    `OR (excluded."updated_at" = ${q(t.name)}."updated_at" AND excluded."version" > ${q(t.name)}."version")`;
}

/** Column values in declared order, for binding to upsertSql. */
export function rowValues(t: SyncTable, row: Record<string, unknown>): unknown[] {
  return t.columns.map((c) => (row[c] === undefined ? null : row[c]));
}

/** Local rows changed since a cursor (app PUSH). Single-store device: no scope. */
export function changedSinceSql(t: SyncTable): string {
  return `SELECT * FROM ${q(t.name)} WHERE ${q(t.timeColumn)} > ? ORDER BY ${q(t.timeColumn)} ASC`;
}

/** Store-scoped rows changed since a cursor (server PULL). Params: [storeId, since]. */
export function pullSql(t: SyncTable): string {
  const time = `${q(t.name)}.${q(t.timeColumn)}`;
  if (t.scope.kind === 'self') {
    return `SELECT * FROM ${q(t.name)} WHERE ${q(t.name)}."id" = ? AND ${time} > ? ORDER BY ${time} ASC`;
  }
  if (t.scope.kind === 'column') {
    return `SELECT * FROM ${q(t.name)} WHERE ${q(t.name)}."store_id" = ? AND ${time} > ? ORDER BY ${time} ASC`;
  }
  const p = t.scope;
  return `SELECT ${q(t.name)}.* FROM ${q(t.name)} JOIN ${q(p.table)} ON ${q(p.table)}."id" = ${q(t.name)}.${q(p.fk)} ` +
    `WHERE ${q(p.table)}."store_id" = ? AND ${time} > ? ORDER BY ${time} ASC`;
}

/** The store_id a pushed row belongs to, for server-side ownership checks. */
export function rowStoreId(t: SyncTable, row: Record<string, unknown>): string | null {
  if (t.scope.kind === 'self') return (row['id'] as string) ?? null;
  if (t.scope.kind === 'column') return (row['store_id'] as string) ?? null;
  return null; // child tables inherit their parent's store; trusted by id
}
