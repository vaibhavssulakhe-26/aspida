// Content scripts load their modules by dynamic import from the extension, so
// every module reachable from src/content/main.js must be web-accessible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './helpers.js';

const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const patterns = manifest.web_accessible_resources.flatMap((w) => w.resources);
const accessible = (rel) => patterns.some((p) => (p.endsWith('/*') ? rel.startsWith(p.slice(0, -1)) && !rel.slice(p.length - 1).includes('/') : rel === p));

test('every module the content scripts import is listed in web_accessible_resources', () => {
  const seen = new Set();
  const visit = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = readFileSync(path.join(root, rel), 'utf8');
    for (const m of src.matchAll(/\bimport\s*(?:[^'"()]*?from\s*)?\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
  };
  visit('src/content/main.js');
  assert.ok(seen.has('src/config/tlds.js') && seen.has('src/config/strings/kn.js'), 'import walk reached nested modules');
  const missing = [...seen].filter((rel) => !accessible(rel));
  assert.deepEqual(missing, [], `not web-accessible: ${missing.join(', ')}`);
});
