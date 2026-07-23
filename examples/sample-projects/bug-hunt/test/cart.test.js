import assert from 'node:assert/strict';
import test from 'node:test';
import { cartTotal } from '../src/cart.js';

test('applies percentage discounts before tax', () => {
  const total = cartTotal(
    [
      { quantity: 2, unitPrice: 20, discount: 10 },
      { quantity: 1, unitPrice: 15, discount: 0 },
    ],
    10,
  );

  assert.equal(total, 56.1);
});

test('returns zero for an empty cart', () => {
  assert.equal(cartTotal([], 10), 0);
});
