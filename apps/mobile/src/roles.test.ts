import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, hashPin, verifyPin, randomSalt, isValidPin } from './roles.ts';

test('capabilities respect role rank', () => {
  assert.equal(can('owner', 'staff'), true);
  assert.equal(can('manager', 'staff'), false); // only owners manage staff
  assert.equal(can('manager', 'reports'), true);
  assert.equal(can('cashier', 'reports'), false);
  assert.equal(can('cashier', 'products'), false);
  assert.equal(can('owner', 'shop'), true);
  assert.equal(can('manager', 'shop'), false); // shop profile is owner-only
});

test('PIN hash is salted, verifiable, and not plaintext', () => {
  const salt = randomSalt();
  const h = hashPin('1234', salt);
  assert.notEqual(h, '1234');
  assert.equal(verifyPin('1234', salt, h), true);
  assert.equal(verifyPin('0000', salt, h), false);
  // same PIN, different salt => different hash (no visible collision)
  assert.notEqual(h, hashPin('1234', randomSalt()));
});

test('isValidPin requires exactly 4 digits', () => {
  assert.equal(isValidPin('1234'), true);
  assert.equal(isValidPin('123'), false);
  assert.equal(isValidPin('12a4'), false);
  assert.equal(isValidPin('12345'), false);
});
