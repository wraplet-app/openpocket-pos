import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, parseCsv } from '../src/csv.ts';

test('toCsv escapes commas, quotes and newlines', () => {
  const csv = toCsv(['name', 'note'], [
    ['Cola', 'plain'],
    ['Rice, 1kg', 'has "quotes"'],
    ['Multi\nline', null],
  ]);
  assert.equal(
    csv,
    'name,note\nCola,plain\n"Rice, 1kg","has ""quotes"""\n"Multi\nline",',
  );
});

test('parseCsv round-trips quoted fields', () => {
  const csv = toCsv(['name', 'price'], [['Rice, 1kg', '150'], ['Say "hi"', '10']]);
  const rows = parseCsv(csv);
  assert.deepEqual(rows, [
    ['name', 'price'],
    ['Rice, 1kg', '150'],
    ['Say "hi"', '10'],
  ]);
});

test('parseCsv handles CRLF and trailing newline', () => {
  const rows = parseCsv('a,b\r\n1,2\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2']]);
});

test('parseCsv keeps empty cells', () => {
  assert.deepEqual(parseCsv('a,,c'), [['a', '', 'c']]);
});
