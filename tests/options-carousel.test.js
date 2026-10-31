import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapIndex, step, offset, offsets, visibleOrder } from '../src/ui/options/carousel.js';
import { loopDistance } from '../src/core/belt.js';

const TABS = ['about', 'features', 'feeds', 'allowlist', 'stats', 'data'];
const n = TABS.length;

test('step wraps both ways around the loop', () => {
  assert.equal(step(0, -1, n), 5, 'left of About is Your data');
  assert.equal(step(5, 1, n), 0, 'right of Your data is About');
  assert.equal(step(2, 7, n), 3);
  assert.equal(wrapIndex(-13, n), 5);
});

test('the selected item is the centre (offset 0); neighbours on both sides', () => {
  assert.deepEqual(offsets(0, n), [0, 1, 2, 3, -2, -1]);
  for (let sel = 0; sel < n; sel++) {
    const o = offsets(sel, n);
    assert.equal(o[sel], 0);
    assert.equal(o.filter((d) => d === 0).length, 1);
    assert.ok(o.includes(-1) && o.includes(1), 'always one on each side');
    assert.ok(o.every((d) => d > -n / 2 && d <= n / 2));
  }
  assert.equal(offset(3, 0, n), 3, 'the opposite item sits at +3');
});

test('visible order: About selected by default, loop shown left to right', () => {
  assert.deepEqual(visibleOrder(0, n, 2).map((i) => TABS[i]), ['stats', 'data', 'about', 'features', 'feeds']);
  assert.deepEqual(visibleOrder(0, n, 1).map((i) => TABS[i]), ['data', 'about', 'features'], 'narrow: one each side');
  assert.deepEqual(visibleOrder(5, n, 1).map((i) => TABS[i]), ['stats', 'data', 'about']);
  assert.equal(visibleOrder(0, n, 9).length, 5, 'never shows an item twice');
});

test('whole-item offsets agree with the continuous belt at integer positions', () => {
  for (let sel = 0; sel < n; sel++) offsets(sel, n).forEach((d, i) => assert.equal(loopDistance(i, sel, n), d));
});
