/**
 * Deterministic money math. All amounts are integer minor units (Minor).
 * No floating-point arithmetic ever leaves this module.
 *
 * Rounding is round-half-away-from-zero, applied ONLY where a percentage
 * forces a fractional minor unit. It is the single, tested rounding point
 * for the whole app — do not round anywhere else.
 */
import { asBps, asMinor, type Bps, type CurrencyConfig, type Minor } from '@openpocket/types';

const isSafeInt = (n: number): boolean => Number.isSafeInteger(n);

function assertInt(n: number, label: string): void {
  if (!isSafeInt(n)) throw new RangeError(`${label} must be a safe integer, got ${n}`);
}

/** Round half away from zero, deterministic. Input may be fractional. */
export function roundHalfAwayFromZero(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

export const zero = (): Minor => asMinor(0);

export function add(a: Minor, b: Minor): Minor {
  const r = a + b;
  assertInt(r, 'sum');
  return asMinor(r);
}

export function subtract(a: Minor, b: Minor): Minor {
  const r = a - b;
  assertInt(r, 'difference');
  return asMinor(r);
}

export function sum(values: readonly Minor[]): Minor {
  return values.reduce<Minor>((acc, v) => add(acc, v), zero());
}

/** Multiply money by an integer count (e.g. unit price × quantity). Exact. */
export function multiplyByQuantity(amount: Minor, quantity: number): Minor {
  assertInt(quantity, 'quantity');
  const r = amount * quantity;
  assertInt(r, 'line gross');
  return asMinor(r);
}

/**
 * Apply a basis-point rate to an amount, rounding to whole minor units.
 * e.g. applyRate(10000 minor, 250 bps) = 250 minor (2.5%).
 */
export function applyRate(amount: Minor, rate: Bps): Minor {
  assertInt(rate, 'rate');
  return asMinor(roundHalfAwayFromZero((amount * rate) / 10000));
}

/** Clamp to >= 0. Discounts must never exceed the base they apply to. */
export function clampNonNegative(amount: Minor): Minor {
  return amount < 0 ? zero() : amount;
}

export const min = (a: Minor, b: Minor): Minor => (a < b ? a : b);
export const max = (a: Minor, b: Minor): Minor => (a > b ? a : b);

/** Parse a major-unit string ("150", "150.75") into Minor for the currency. */
export function fromMajorString(input: string, decimals: number): Minor {
  assertInt(decimals, 'decimals');
  if (decimals < 0) throw new RangeError('decimals must be >= 0');
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new RangeError(`Not a valid money string: "${input}"`);
  }
  const negative = trimmed.startsWith('-');
  const [whole, frac = ''] = trimmed.replace('-', '').split('.');
  if (frac.length > decimals) {
    throw new RangeError(`Too many decimal places for currency (max ${decimals})`);
  }
  const paddedFrac = frac.padEnd(decimals, '0');
  const combined = `${whole}${paddedFrac}`.replace(/^0+(?=\d)/, '');
  const value = Number(combined);
  assertInt(value, 'parsed amount');
  return asMinor(negative ? -value : value);
}

/** Convert Minor to a major-unit number (may be fractional). Display only. */
export function toMajorNumber(amount: Minor, decimals: number): number {
  return amount / 10 ** decimals;
}

// Intl.NumberFormat construction is expensive; cache one per currency config
// (js-hoist-intl) so list rows don't rebuild a formatter on every render.
const _formatters = new Map<string, Intl.NumberFormat>();
function formatterFor(currency: CurrencyConfig): Intl.NumberFormat | null {
  const key = `${currency.locale}|${currency.code}|${currency.decimals}`;
  const cached = _formatters.get(key);
  if (cached) return cached;
  try {
    const f = new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    });
    _formatters.set(key, f);
    return f;
  } catch {
    return null;
  }
}

/** Locale-aware formatted string, e.g. "Rs 150.75". Uses platform Intl. */
export function format(amount: Minor, currency: CurrencyConfig): string {
  const major = toMajorNumber(amount, currency.decimals);
  const f = formatterFor(currency);
  // Unknown currency/locale on the platform — fall back to code + number.
  return f ? f.format(major) : `${currency.code} ${major.toFixed(currency.decimals)}`;
}

export { asBps, asMinor };
