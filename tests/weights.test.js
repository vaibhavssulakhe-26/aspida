import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { WEIGHTS } from '../src/scoring/weights.js';

// Every signal id used in a check must exist in the weight table, and every
// weight-table entry must be used somewhere (no dead config).
test('weight table and checks agree', () => {
  const dir = new URL('../src/checks/', import.meta.url);
  const used = new Set();
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/signal\('([a-z_.-]+)'/g)) used.add(m[1]);
  }
  for (const id of used) assert.ok(id in WEIGHTS, `missing weight for ${id}`);
  for (const id of Object.keys(WEIGHTS)) assert.ok(used.has(id), `unused weight ${id}`);
});

test('checks are pure: no chrome.* or network in src/checks, src/core, src/scoring', () => {
  for (const d of ['checks', 'core', 'scoring']) {
    const dir = new URL(`../src/${d}/`, import.meta.url);
    for (const f of readdirSync(dir)) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      assert.doesNotMatch(src, /\bchrome\.[a-z]|\bfetch\(|XMLHttpRequest|indexedDB/, `${d}/${f}`);
    }
  }
});
