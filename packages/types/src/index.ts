/**
 * @openpocket/types — shared domain primitives.
 * Pure TypeScript, no runtime deps, no React Native. Safe to import anywhere.
 */

/**
 * Money is stored as an integer number of a currency's minor units
 * (e.g. paisa for PKR, cents for USD). NEVER a float. The number of minor
 * units per major unit is the currency's `decimals` (2 for PKR/USD, 0 for JPY).
 * `decimals` lives on the store's currency config, not on the value itself,
 * so a bare Minor is only meaningful alongside its currency.
 */
export type Minor = number & { readonly __brand: 'Minor' };

/** Basis points: 1% = 100 bps, 100% = 10000 bps. Integer, avoids float rates. */
export type Bps = number & { readonly __brand: 'Bps' };

/** Cast helpers. These assert integer-ness; callers own validation upstream. */
export const asMinor = (n: number): Minor => n as Minor;
export const asBps = (n: number): Bps => n as Bps;

/** Business-entity id. ULID/UUID string, generated at the edge (app), never here. */
export type Id = string;

/**
 * Fields every syncable entity carries from day one, so adding the cloud
 * sync module later needs no schema restructuring. See docs/architecture.md.
 */
export interface SyncFields {
  id: Id;
  created_at: number; // epoch ms
  updated_at: number; // epoch ms
  device_id: string;
  version: number; // bumped on every local mutation; used for conflict detection
}

/** Master data that soft-deletes rather than hard-deletes. */
export interface SoftDelete {
  deleted_at: number | null;
}

export interface CurrencyConfig {
  code: string; // ISO 4217, e.g. "PKR"
  locale: string; // BCP-47, e.g. "en-PK" or "ur-PK"
  decimals: number; // minor units per major, e.g. 2
}

export type PaymentType = 'cash' | 'card' | 'wallet' | 'bank' | 'credit' | 'other';

export type StockMovementType =
  | 'opening_stock'
  | 'sale'
  | 'sale_return'
  | 'purchase'
  | 'purchase_return'
  | 'adjustment'
  | 'damaged'
  | 'transfer';

export type LedgerEntryType = 'sale' | 'payment' | 'refund' | 'adjustment';

export type Role = 'owner' | 'manager' | 'cashier';
