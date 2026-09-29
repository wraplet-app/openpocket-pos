import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  add,
  applyRate,
  format,
  fromMajorString,
  multiplyByQuantity,
  roundHalfAwayFromZero,
  subtract,
  sum,
  toMajorNumber,
} from '../src/money.ts';
import { asBps, asMinor } from '@openpocket/types';

test('add/subtract/sum are exact', () => {
  assert.equal(add(asMinor(150), asMinor(75)), 225);
  assert.equal(subtract(asMinor(150), asMinor(75)), 75);
  assert.equal(sum([asMinor(10), asMinor(20), asMinor(30)]), 60);
  assert.equal(sum([]), 0);
});

test('multiplyByQuantity handles zero and large quantities', () => {
  assert.equal(multiplyByQuantity(asMinor(15000), 3), 45000);
  assert.equal(multiplyByQuantity(asMinor(15000), 0), 0);
  assert.equal(multiplyByQuantity(asMinor(1), 1_000_000), 1_000_000);
});

test('roundHalfAwayFromZero is symmetric around zero', () => {
  assert.equal(roundHalfAwayFromZero(2.5), 3);
  assert.equal(roundHalfAwayFromZero(-2.5), -3);
  assert.equal(roundHalfAwayFromZero(2.4), 2);
  assert.equal(roundHalfAwayFromZero(-2.6), -3);
});

test('applyRate rounds fractional minor units deterministically', () => {
  // 2.5% of 10000 = 250 exact
  assert.equal(applyRate(asMinor(10000), asBps(250)), 250);
  // 17% of 199 = 33.83 -> 34
  assert.equal(applyRate(asMinor(199), asBps(1700)), 34);
  // 100% and 0%
  assert.equal(applyRate(asMinor(199), asBps(10000)), 199);
  assert.equal(applyRate(asMinor(199), asBps(0)), 0);
});

test('fromMajorString parses to minor units', () => {
  assert.equal(fromMajorString('150', 2), 15000);
  assert.equal(fromMajorString('150.75', 2), 15075);
  assert.equal(fromMajorString('0.05', 2), 5);
  assert.equal(fromMajorString('1000', 0), 1000); // JPY-style, 0 decimals
  assert.throws(() => fromMajorString('1.999', 2), RangeError);
  assert.throws(() => fromMajorString('abc', 2), RangeError);
});

test('toMajorNumber is display-only inverse', () => {
  assert.equal(toMajorNumber(asMinor(15075), 2), 150.75);
});

test('format falls back gracefully for unknown currency', () => {
  const s = format(asMinor(15075), { code: 'XYZ', locale: 'en', decimals: 2 });
  assert.match(s, /150\.75/);
});
