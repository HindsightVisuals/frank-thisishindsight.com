import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageIndex } from '../js/work.js';

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
