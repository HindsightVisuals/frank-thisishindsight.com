import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageIndex, logoBox, LOGO_AREA } from '../js/work.js';

test('the page index follows the scroll position, rounding to the nearest page', () => {
  assert.equal(pageIndex(0, 800, 5), 0);
  assert.equal(pageIndex(1190, 800, 5), 1);
  assert.equal(pageIndex(1210, 800, 5), 2);
});

test('the page index stays inside the guide', () => {
  assert.equal(pageIndex(-50, 800, 5), 0);
  assert.equal(pageIndex(99999, 800, 5), 4);
  assert.equal(pageIndex(100, 0, 5), 0);
});

test('logos of any shape cover the same share of their tile', () => {
  for (const ar of [0.5, 1, 3, 5]) {
    const { w, h } = logoBox(ar);
    assert.ok(Math.abs(w * h - LOGO_AREA) < 1e-9, `area at ${ar}`);
    assert.ok(Math.abs((w * 4) / (h * 3) - ar) < 1e-9, `shape at ${ar}`);
  }
});

test('an extremely long logo shrinks to stay inside its tile', () => {
  const { w, h } = logoBox(40);
  assert.ok(w <= 0.6 + 1e-9 && h > 0);
});
