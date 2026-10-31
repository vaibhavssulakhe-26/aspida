import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_MS, SPEED, MAX_DT_MS, REST_AT, REST_SCALE, REST_OPACITY, HIGHLIGHT_TO, labelFor,
  wrapPosition, loopDistance, clampDt, advance, scaleFor, highlightFor, opacityFor, slotX, targetFor, easeOutCubic, easeInQuad, nearestItem,
} from '../src/core/belt.js';

const n = 6;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('speed: one item per 2000 ms, independent of frame rate', () => {
  close(SPEED * ITEM_MS, 1);
  // 2 s in 60 fps frames vs 144 fps frames: same position.
  let a = 0;
  let b = 0;
  for (let t = 0; t < 120; t++) a = advance(a, 2000 / 120, n);
  for (let t = 0; t < 288; t++) b = advance(b, 2000 / 288, n);
  close(a, 1, 1e-6);
  close(b, 1, 1e-6);
});

test('dt is clamped: a long gap (hidden tab, jank) never jumps', () => {
  assert.equal(clampDt(60_000), MAX_DT_MS);
  assert.equal(clampDt(-5), 0);
  assert.equal(clampDt(undefined), 0);
  close(advance(0, 60_000, n), MAX_DT_MS * SPEED);
  close(advance(0, 1000, n, 0.5), 0.05 * 0.5, 1e-9); // ease-in factor scales the step (dt clamped to 100)
});

test('position wraps seamlessly around the loop', () => {
  close(wrapPosition(6.25, n), 0.25);
  close(wrapPosition(-0.25, n), 5.75);
  close(advance(5.99, 50, n), wrapPosition(5.99 + 50 * SPEED, n));
  assert.equal(nearestItem(5.6, n), 0, 'item 0 after item 5');
  assert.equal(nearestItem(2.4, n), 2);
});

test('shortest-path distance around the loop', () => {
  close(loopDistance(1, 0, n), 1);
  close(loopDistance(5, 0, n), -1); // item 5 is left of item 0
  close(loopDistance(3, 0, n), 3); // opposite item: +n/2
  close(loopDistance(0, 5.5, n), 0.5);
  close(loopDistance(5, 0.25, n), -1.25);
  for (let p = 0; p < n; p += 0.37) for (let i = 0; i < n; i++) {
    const d = loopDistance(i, p, n);
    assert.ok(d > -n / 2 && d <= n / 2);
    close(wrapPosition(p + d, n), i, 1e-9);
  }
  close(targetFor(5, 0.3, n), -1); // eases left, not the long way round
  close(targetFor(2, 0.3, n), 2);
});

test('scale / highlight / opacity: centre = 1, continuous, monotonic, resting from 1.5 items', () => {
  assert.equal(scaleFor(0), 1);
  assert.equal(highlightFor(0), 1);
  assert.equal(opacityFor(0), 1);
  close(scaleFor(REST_AT), REST_SCALE);
  close(scaleFor(2.2), REST_SCALE);
  assert.equal(highlightFor(REST_AT), 0);
  assert.equal(highlightFor(HIGHLIGHT_TO), 0);
  assert.equal(highlightFor(1), 0, 'resting neighbours: no fill');
  assert.equal(labelFor(0), 1);
  assert.equal(labelFor(HIGHLIGHT_TO), 0);
  close(opacityFor(2), REST_OPACITY);
  assert.ok(opacityFor(2.75) === 0 && opacityFor(3) === 0, 'invisible where items wrap');
  assert.ok(opacityFor(1.75, 1) === 0, 'narrow: one neighbour each side');
  let prev = { s: scaleFor(0), h: highlightFor(0), o: opacityFor(0) };
  for (let d = 0; d <= 3; d += 0.01) {
    const s = scaleFor(d);
    const h = highlightFor(d);
    const o = opacityFor(d);
    const l = labelFor(d);
    assert.ok(l <= labelFor(Math.max(0, d - 0.01)) + 1e-12, `label monotonic at ${d}`);
    assert.ok(s <= prev.s + 1e-12 && h <= prev.h + 1e-12 && o <= prev.o + 1e-12, `monotonic at ${d}`);
    assert.ok(prev.s - s < 0.01 && prev.h - h < 0.04 && prev.o - o < 0.03, `continuous at ${d}`);
    assert.equal(scaleFor(-d), s, 'symmetric');
    prev = { s, h, o };
  }
});

test('slot offsets: continuous, monotonic, symmetric', () => {
  assert.equal(slotX(0), 0);
  close(slotX(1), 1.02);
  close(slotX(-2), -1.92);
  close(slotX(0.5), 0.51);
  let prev = slotX(-3);
  for (let d = -3; d <= 3; d += 0.01) {
    const x = slotX(d);
    assert.ok(x >= prev - 1e-12 && x - prev < 0.02 + 1e-9);
    prev = x;
  }
});

test('easing curves start at 0, end at 1 and are clamped', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
  assert.ok(easeOutCubic(0.5) > 0.5, 'ease-out: fast start');
  assert.equal(easeInQuad(0), 0);
  assert.equal(easeInQuad(1), 1);
  assert.ok(easeInQuad(0.5) < 0.5, 'ease-in: slow start');
});
