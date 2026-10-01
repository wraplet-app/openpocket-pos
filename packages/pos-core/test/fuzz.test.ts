import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromMajorString, toMajorNumber, asMinor } from '../src/money.ts';
import { toCsv, parseCsv } from '../src/csv.ts';

/**
 * Property / fuzz tests: dynamic analysis that *varies* the inputs on every run
 * instead of checking a handful of fixed cases. Each test asserts an invariant
 * that must hold for all inputs, so random inputs can surface crashes or bad
 * outputs the example-based tests would miss. A seeded PRNG keeps any failure
 * reproducible.
 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}
const randInt = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

test('fuzz: money parser only ever returns a safe-integer Minor or throws RangeError', () => {
  const r = makeRng(0xc0ffee);
  const chars = '0123456789.-+ eExXabc,$£'.split('');
  for (let i = 0; i < 20_000; i++) {
    let s = '';
    const len = randInt(r, 0, 12);
    for (let k = 0; k < len; k++) s += pick(r, chars);
    const decimals = pick(r, [0, 2, 3]);
    try {
      const out = fromMajorString(s, decimals) as unknown as number;
      assert.ok(Number.isSafeInteger(out), `non-integer result for ${JSON.stringify(s)}: ${out}`);
    } catch (e) {
      assert.ok(e instanceof RangeError, `unexpected error for ${JSON.stringify(s)}: ${String(e)}`);
    }
  }
});

test('fuzz: valid minor values round-trip through major → parse', () => {
  const r = makeRng(0x1234abcd);
  for (let i = 0; i < 10_000; i++) {
    const decimals = pick(r, [0, 2, 3]);
    const minor = randInt(r, 0, 1_000_000_000); // non-negative, within double precision
    const back = fromMajorString(String(toMajorNumber(asMinor(minor), decimals)), decimals);
    assert.equal(back, minor, `round-trip failed: minor=${minor} decimals=${decimals}`);
  }
});

test('fuzz: CSV survives a round-trip of random cells (commas, quotes, spaces, unicode)', () => {
  const r = makeRng(0xbeef00);
  const cellChars = 'ab, "\t€x12'.split(''); // comma + quote + whitespace + unicode + digits
  for (let i = 0; i < 3_000; i++) {
    const cols = randInt(r, 1, 4);
    const mkRow = () => {
      const row = Array.from({ length: cols }, () => {
        let c = '';
        const len = randInt(r, 0, 6);
        for (let k = 0; k < len; k++) c += pick(r, cellChars);
        return c;
      });
      // A lone empty cell serialises to a blank line, which CSV cannot tell apart
      // from end-of-data — an inherent format ambiguity, not a parser bug. Keep
      // single-column rows non-empty so the round-trip invariant is well-defined.
      if (row.length === 1 && row[0] === '') row[0] = pick(r, cellChars);
      return row;
    };
    const headers = mkRow();
    const rows = Array.from({ length: randInt(r, 0, 3) }, mkRow);
    assert.deepEqual(parseCsv(toCsv(headers, rows)), [headers, ...rows], 'CSV round-trip mismatch');
  }
});
