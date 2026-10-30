import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { iconStateForVerdict, iconTitleForVerdict, iconPaths, ICON_STATES } from '../src/scoring/icon-state.js';
import { TOOLBAR_TITLES } from '../src/scoring/weights.js';
import { analyzeUrl } from '../src/core/pipeline.js';
import { makeCtx } from './helpers.js';

test('iconStateForVerdict maps tiers to icon states', () => {
  assert.equal(iconStateForVerdict({ tier: 'none' }), 'green');
  assert.equal(iconStateForVerdict({ tier: 'suspicious' }), 'orange');
  assert.equal(iconStateForVerdict({ tier: 'high' }), 'red');
  assert.equal(iconStateForVerdict({ tier: 'malicious' }), 'red');
});

test('unchecked, unknown or broken verdicts give the normal icon', () => {
  for (const v of [null, undefined, {}, { tier: 'weird' }, { tier: 'toString' }, 'none', 42]) {
    assert.equal(iconStateForVerdict(v), 'normal', JSON.stringify(v));
    assert.equal(iconTitleForVerdict(v), TOOLBAR_TITLES.normal);
  }
});

test('toolbar titles follow the wording rule', () => {
  for (const t of Object.values(TOOLBAR_TITLES)) {
    assert.match(t, /^Aspida/);
    assert.doesNotMatch(t, /\bsafe/i);
  }
  assert.match(iconTitleForVerdict({ tier: 'none' }), /No known threats found/);
});

test('every icon state has its PNGs on disk', () => {
  for (const s of ICON_STATES) {
    for (const p of Object.values(iconPaths(s))) {
      assert.match(p, /^\/icons\//, 'absolute from the extension root');
      assert.ok(existsSync(fileURLToPath(new URL(`..${p}`, import.meta.url))), p);
    }
  }
  assert.deepEqual(iconPaths('bogus'), iconPaths('normal'));
});

test('real pipeline verdicts map to the expected icon', () => {
  const c = makeCtx();
  assert.equal(iconStateForVerdict(analyzeUrl('https://www.wikipedia.org/', c, [])), 'green');
  assert.equal(iconStateForVerdict(analyzeUrl('https://paypa1.com/login', c, [])), 'red');
  assert.equal(iconStateForVerdict(analyzeUrl('chrome://newtab/', c, [])), 'normal');
});
