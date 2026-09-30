import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAccent, onAccent, contactLines, shopInitials, normalizeUrl, DEFAULT_ACCENT, defaultCurrencyFor, localeForCurrency, CURRENCIES } from './branding.ts';

test('safeAccent only accepts #rrggbb and falls back otherwise', () => {
  assert.equal(safeAccent('#2563EB'), '#2563eb');
  assert.equal(safeAccent('  #ea580c '), '#ea580c');
  assert.equal(safeAccent('red'), DEFAULT_ACCENT);
  assert.equal(safeAccent('#fff'), DEFAULT_ACCENT);
  assert.equal(safeAccent(null), DEFAULT_ACCENT);
  // must never let CSS through
  assert.equal(safeAccent('#000000;background:url(x)'), DEFAULT_ACCENT);
});

test('onAccent picks readable text', () => {
  assert.equal(onAccent('#111827'), '#ffffff');
  assert.equal(onAccent('#fde047'), '#111827');
});

test('contactLines drops blanks and keeps order', () => {
  assert.deepEqual(contactLines({ address: ' 12 Main St ', phone: '', email: 'a@b.co', website: null }), ['12 Main St', 'a@b.co']);
  assert.deepEqual(contactLines({}), []);
});

test('shopInitials and normalizeUrl', () => {
  assert.equal(shopInitials('Bin Hashim Mart'), 'BH');
  assert.equal(shopInitials('  '), '?');
  assert.equal(normalizeUrl('https://shop.example.com/'), 'shop.example.com');
});

test('defaultCurrencyFor maps device regions to a currency, defaulting to USD', () => {
  assert.equal(defaultCurrencyFor('en-US'), 'USD');
  assert.equal(defaultCurrencyFor('en-GB'), 'GBP');
  assert.equal(defaultCurrencyFor('fr_FR'), 'EUR');
  assert.equal(defaultCurrencyFor('en-CA'), 'CAD');
  assert.equal(defaultCurrencyFor('ur-PK'), 'PKR');
  assert.equal(defaultCurrencyFor('ja-JP'), 'USD'); // unmapped region
  assert.equal(defaultCurrencyFor('en'), 'USD');    // no region
  assert.equal(defaultCurrencyFor(null), 'USD');
});

test('every offered currency has a Latin-digit English locale', () => {
  for (const c of CURRENCIES) assert.match(c.locale, /^en-/, c.code);
  assert.equal(localeForCurrency('GBP'), 'en-GB');
  assert.equal(localeForCurrency('XXX'), 'en-US');
});
