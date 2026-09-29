/**
 * Profit uses the unit-cost SNAPSHOT captured at sale time, never the
 * product's current cost. Revenue is net of discount and excludes tax
 * (tax is not the merchant's margin).
 */
import type { Minor } from '@openpocket/types';
import { computeLine, type LineDiscount } from './pricing.ts';
import { multiplyByQuantity, subtract } from './money.ts';

export interface ProfitLineInput {
  readonly unitPrice: Minor;
  readonly unitCost: Minor; // snapshot from time of sale
  readonly quantity: number;
  readonly discount?: LineDiscount;
  readonly taxBps?: number;
}

/** Gross profit for a single sold line: net revenue − cost of goods. */
export function lineProfit(input: ProfitLineInput): Minor {
  const { taxable } = computeLine({
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    discount: input.discount,
  });
  const cost = multiplyByQuantity(input.unitCost, input.quantity);
  return subtract(taxable, cost);
}
