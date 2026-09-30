/**
 * Cart pricing engine. Pure, deterministic, framework-free.
 * Every monetary value in and out is Minor (integer minor units).
 *
 * Order of operations per line:
 *   gross     = unitPrice × quantity
 *   discount  = fixed amount, or percent of gross (clamped to gross)
 *   taxable   = gross − discount
 *   tax       = taxable × taxBps
 *   lineTotal = taxable + tax
 */
import type { Bps, Minor } from '@openpocket/types';
import {
  add,
  applyRate,
  min,
  multiplyByQuantity,
  subtract,
  sum,
  zero,
} from './money.ts';

export type LineDiscount =
  | { readonly kind: 'none' }
  | { readonly kind: 'amount'; readonly value: Minor }
  | { readonly kind: 'percent'; readonly bps: Bps };

export interface CartLineInput {
  readonly unitPrice: Minor;
  readonly quantity: number; // integer >= 0
  readonly discount?: LineDiscount;
  readonly taxBps?: Bps; // line tax rate; omit or 0 for tax-free
}

export interface CartLineTotals {
  readonly gross: Minor;
  readonly discount: Minor;
  readonly taxable: Minor;
  readonly tax: Minor;
  readonly lineTotal: Minor;
}

export interface CartTotals {
  readonly lines: readonly CartLineTotals[];
  readonly subtotal: Minor; // sum of gross
  readonly lineDiscountTotal: Minor;
  readonly cartDiscount: Minor; // bill-level discount actually applied
  readonly discountTotal: Minor; // lineDiscountTotal + cartDiscount
  readonly taxTotal: Minor;
  readonly grandTotal: Minor;
}

function resolveLineDiscount(gross: Minor, discount: LineDiscount | undefined): Minor {
  if (!discount || discount.kind === 'none') return zero();
  if (discount.kind === 'amount') return min(discount.value, gross);
  return min(applyRate(gross, discount.bps), gross);
}

export function computeLine(line: CartLineInput): CartLineTotals {
  if (!Number.isInteger(line.quantity) || line.quantity < 0) {
    throw new RangeError(`quantity must be a non-negative integer, got ${line.quantity}`);
  }
  if (line.unitPrice < 0) {
    throw new RangeError(`unitPrice must be non-negative, got ${line.unitPrice}`);
  }
  const gross = multiplyByQuantity(line.unitPrice, line.quantity);
  const discount = resolveLineDiscount(gross, line.discount);
  const taxable = subtract(gross, discount);
  const tax = line.taxBps ? applyRate(taxable, line.taxBps) : zero();
  const lineTotal = add(taxable, tax);
  return { gross, discount, taxable, tax, lineTotal };
}

/**
 * Optional bill-level discount applied AFTER line math and after tax.
 * ponytail: cart discount does not recompute per-line tax base in V0.1
 * (tax is charged on line-level taxable amounts). If a jurisdiction requires
 * bill discounts to reduce the tax base, distribute it across lines instead —
 * that's a V0.3 concern, tracked in docs/roadmap.md.
 */
export type CartDiscount =
  | { readonly kind: 'none' }
  | { readonly kind: 'amount'; readonly value: Minor }
  | { readonly kind: 'percent'; readonly bps: Bps };

export function computeCart(
  inputs: readonly CartLineInput[],
  cartDiscount: CartDiscount = { kind: 'none' },
): CartTotals {
  const lines = inputs.map(computeLine);
  const subtotal = sum(lines.map((l) => l.gross));
  const lineDiscountTotal = sum(lines.map((l) => l.discount));
  const taxTotal = sum(lines.map((l) => l.tax));
  const afterLines = sum(lines.map((l) => l.lineTotal));

  let cartDiscountAmount = zero();
  if (cartDiscount.kind === 'amount') {
    cartDiscountAmount = min(cartDiscount.value, afterLines);
  } else if (cartDiscount.kind === 'percent') {
    cartDiscountAmount = min(applyRate(afterLines, cartDiscount.bps), afterLines);
  }

  const grandTotal = subtract(afterLines, cartDiscountAmount);
  return {
    lines,
    subtotal,
    lineDiscountTotal,
    cartDiscount: cartDiscountAmount,
    discountTotal: add(lineDiscountTotal, cartDiscountAmount),
    taxTotal,
    grandTotal,
  };
}

/* ------------------------------- payments -------------------------------- */

export interface PaymentInput {
  readonly amount: Minor;
}

export interface PaymentSettlement {
  readonly totalPaid: Minor;
  readonly grandTotal: Minor;
  readonly change: Minor; // amount owed back to customer (0 if none)
  readonly outstanding: Minor; // amount still due (0 if fully paid)
  readonly isFullyPaid: boolean;
}

/**
 * Settle one or more payments against a total. Works for single cash, split
 * payments, and partial (credit) payments. `allowUnderpayment` must be true
 * to accept a total that leaves an outstanding balance (i.e. a credit sale).
 */
export function settlePayments(
  grandTotal: Minor,
  payments: readonly PaymentInput[],
  opts: { readonly allowUnderpayment?: boolean } = {},
): PaymentSettlement {
  const totalPaid = sum(payments.map((p) => p.amount));
  const diff = subtract(totalPaid, grandTotal);
  const change = diff > 0 ? diff : zero();
  const outstanding = diff < 0 ? (Math.abs(diff) as Minor) : zero();
  const isFullyPaid = outstanding === 0;
  if (!isFullyPaid && !opts.allowUnderpayment) {
    throw new RangeError('Insufficient payment: total received is less than amount due');
  }
  return { totalPaid, grandTotal, change, outstanding, isFullyPaid };
}

/**
 * Suggested "amount received" buttons for fast cash checkout: the exact total,
 * then the next round numbers up. `steps` are denominations expressed in minor
 * units (e.g. [500, 1000, 2000] for 5/10/20 in a 2-decimal currency).
 */
export function suggestCashAmounts(
  grandTotal: Minor,
  steps: readonly Minor[],
): readonly Minor[] {
  const out: Minor[] = [grandTotal];
  for (const step of steps) {
    if (step <= 0) continue;
    const rounded = (Math.ceil(grandTotal / step) * step) as Minor;
    if (rounded > grandTotal && !out.includes(rounded)) out.push(rounded);
  }
  return out;
}

/**
 * Note/coin denominations (in minor units) to round cash suggestions to, chosen
 * from the size of the sale so the buttons are useful in any currency: small
 * sales get 1/5/10/20/50/100, larger ones also get 500/1,000/5,000/10,000….
 */
export function cashSuggestionSteps(grandTotal: Minor, decimals: number): readonly Minor[] {
  const unit = 10 ** decimals;
  const major = grandTotal / unit;
  const steps = [1, 5, 10, 20, 50, 100];
  for (const big of [500, 1000, 5000, 10000, 50000]) if (major > big / 5) steps.push(big);
  return steps.map((n) => (n * unit) as Minor);
}
