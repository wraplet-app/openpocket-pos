import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asBps, asMinor } from '@openpocket/types';
import {
  computeCart,
  computeLine,
  settlePayments,
  suggestCashAmounts,
  cashSuggestionSteps,
} from '../src/pricing.ts';
import { lineProfit } from '../src/profit.ts';

test('computeLine: plain line, no discount, no tax', () => {
  const l = computeLine({ unitPrice: asMinor(15000), quantity: 3 });
  assert.equal(l.gross, 45000);
  assert.equal(l.discount, 0);
  assert.equal(l.taxable, 45000);
  assert.equal(l.tax, 0);
  assert.equal(l.lineTotal, 45000);
});

test('computeLine: percent discount then tax', () => {
  // 200.00 x 2 = 400.00; 10% off = 40.00; taxable 360.00; 5% tax = 18.00
  const l = computeLine({
    unitPrice: asMinor(20000),
    quantity: 2,
    discount: { kind: 'percent', bps: asBps(1000) },
    taxBps: asBps(500),
  });
  assert.equal(l.gross, 40000);
  assert.equal(l.discount, 4000);
  assert.equal(l.taxable, 36000);
  assert.equal(l.tax, 1800);
  assert.equal(l.lineTotal, 37800);
});

test('computeLine: fixed discount cannot exceed gross (100%+ discount)', () => {
  const l = computeLine({
    unitPrice: asMinor(10000),
    quantity: 1,
    discount: { kind: 'amount', value: asMinor(999999) },
  });
  assert.equal(l.discount, 10000);
  assert.equal(l.taxable, 0);
  assert.equal(l.lineTotal, 0);
});

test('computeLine: 100% percent discount', () => {
  const l = computeLine({
    unitPrice: asMinor(10000),
    quantity: 2,
    discount: { kind: 'percent', bps: asBps(10000) },
    taxBps: asBps(1700),
  });
  assert.equal(l.discount, 20000);
  assert.equal(l.taxable, 0);
  assert.equal(l.tax, 0);
  assert.equal(l.lineTotal, 0);
});

test('computeLine rejects negative price and non-integer quantity', () => {
  assert.throws(() => computeLine({ unitPrice: asMinor(-1), quantity: 1 }), RangeError);
  assert.throws(() => computeLine({ unitPrice: asMinor(100), quantity: 1.5 }), RangeError);
  assert.throws(() => computeLine({ unitPrice: asMinor(100), quantity: -2 }), RangeError);
});

test('computeCart aggregates lines', () => {
  const cart = computeCart([
    { unitPrice: asMinor(15000), quantity: 3 }, // 450.00
    {
      unitPrice: asMinor(20000),
      quantity: 2,
      discount: { kind: 'percent', bps: asBps(1000) },
      taxBps: asBps(500),
    }, // taxable 360, tax 18, total 378
  ]);
  assert.equal(cart.subtotal, 45000 + 40000);
  assert.equal(cart.lineDiscountTotal, 4000);
  assert.equal(cart.taxTotal, 1800);
  assert.equal(cart.grandTotal, 45000 + 37800);
});

test('computeCart with bill-level percent discount', () => {
  const cart = computeCart(
    [{ unitPrice: asMinor(10000), quantity: 1 }],
    { kind: 'percent', bps: asBps(1000) },
  );
  assert.equal(cart.cartDiscount, 1000);
  assert.equal(cart.grandTotal, 9000);
  assert.equal(cart.discountTotal, 1000);
});

test('settlePayments: exact cash, no change', () => {
  const s = settlePayments(asMinor(45000), [{ amount: asMinor(45000) }]);
  assert.equal(s.change, 0);
  assert.equal(s.outstanding, 0);
  assert.equal(s.isFullyPaid, true);
});

test('settlePayments: overpayment yields change', () => {
  const s = settlePayments(asMinor(45000), [{ amount: asMinor(50000) }]);
  assert.equal(s.change, 5000);
  assert.equal(s.outstanding, 0);
});

test('settlePayments: split payment', () => {
  const s = settlePayments(asMinor(45000), [
    { amount: asMinor(20000) },
    { amount: asMinor(25000) },
  ]);
  assert.equal(s.isFullyPaid, true);
  assert.equal(s.change, 0);
});

test('settlePayments: insufficient throws unless underpayment allowed', () => {
  assert.throws(() => settlePayments(asMinor(45000), [{ amount: asMinor(10000) }]), RangeError);
  const credit = settlePayments(
    asMinor(45000),
    [{ amount: asMinor(10000) }],
    { allowUnderpayment: true },
  );
  assert.equal(credit.outstanding, 35000);
  assert.equal(credit.isFullyPaid, false);
});

test('suggestCashAmounts rounds up to denominations', () => {
  // total 137.00 (13700 minor), steps 50/100/200
  const s = suggestCashAmounts(asMinor(13700), [asMinor(5000), asMinor(10000), asMinor(20000)]);
  assert.deepEqual(s, [13700, 15000, 20000]);
});

test('lineProfit uses cost snapshot and net-of-discount revenue', () => {
  // sell 3 @ 150 cost 100, 10% line discount -> revenue 405, cost 300, profit 105
  const p = lineProfit({
    unitPrice: asMinor(15000),
    unitCost: asMinor(10000),
    quantity: 3,
    discount: { kind: 'percent', bps: asBps(1000) },
  });
  assert.equal(p, 40500 - 30000);
});

test('cashSuggestionSteps + suggestCashAmounts give sensible buttons in USD-like currencies', () => {
  // $14.36 -> exact, then $15, $20, $50, $100
  const total = asMinor(1436);
  const s = suggestCashAmounts(total, cashSuggestionSteps(total, 2));
  assert.deepEqual(s, [1436, 1500, 2000, 5000, 10000]);
});

test('cashSuggestionSteps scales up for large totals and respects zero-decimal currencies', () => {
  const big = asMinor(183500); // 1,835.00
  const steps = cashSuggestionSteps(big, 2).map((x) => x / 100);
  assert.ok(steps.includes(500) && steps.includes(1000));
  const yen = cashSuggestionSteps(asMinor(1280), 0); // 1,280 in a 0-decimal currency
  assert.deepEqual(yen.slice(0, 3), [1, 5, 10]);
});
