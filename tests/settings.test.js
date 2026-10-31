import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, mergeSettings, migrateSettings, REMOVED_FEEDS } from '../src/config/settings.js';
import { FEEDS } from '../src/config/feeds.js';

test('verdicts appear on hover only by default: inline chat badges are opt-in', () => {
  assert.equal(DEFAULT_SETTINGS.hoverVerdict, true);
  assert.equal(DEFAULT_SETTINGS.chatInlineBadges, false);
  // Existing installs without the key get the default too.
  assert.equal(mergeSettings({ chatWhatsApp: true }).chatInlineBadges, false);
});

test('toolbar icon follows the site by default, including on existing installs', () => {
  assert.equal(DEFAULT_SETTINGS.toolbarIcon, true);
  assert.equal(mergeSettings({ hoverVerdict: false }).toolbarIcon, true);
});

test('theme: follows the system by default; unknown values fall back to auto', () => {
  assert.equal(DEFAULT_SETTINGS.theme, 'auto');
  assert.equal(mergeSettings({}).theme, 'auto');
  assert.equal(mergeSettings({ theme: 'dark' }).theme, 'dark');
  assert.equal(mergeSettings({ theme: 'light' }).theme, 'light');
  assert.equal(mergeSettings({ theme: 'purple' }).theme, 'auto');
});

test('migration drops the removed URLhaus feed and its Auth-Key', () => {
  const old = { hoverVerdict: false, urlhausAuthKey: 'abc123secretkey', feeds: { openphish: false, urlhaus: true } };
  const { settings, changed } = migrateSettings(old);
  assert.equal(changed, true);
  assert.ok(!Object.hasOwn(settings, 'urlhausAuthKey'));
  assert.ok(!Object.hasOwn(settings.feeds, 'urlhaus'));
  assert.deepEqual(settings, { hoverVerdict: false, feeds: { openphish: false } }, 'other choices kept');
  assert.ok(Object.hasOwn(old, 'urlhausAuthKey') && old.feeds.urlhaus, 'input not mutated');

  assert.equal(migrateSettings({ hoverVerdict: true, feeds: { sample: true } }).changed, false);
  assert.equal(migrateSettings(undefined).changed, false);

  // Merged settings never carry the old keys, even before the stored copy is migrated.
  const merged = mergeSettings(old);
  assert.ok(!Object.hasOwn(merged, 'urlhausAuthKey') && !Object.hasOwn(merged.feeds, 'urlhaus'));
  assert.ok(!Object.hasOwn(DEFAULT_SETTINGS, 'urlhausAuthKey') && !Object.hasOwn(DEFAULT_SETTINGS.feeds, 'urlhaus'));
});

test('every feed has a default switch, and nothing points at URLhaus any more', () => {
  for (const f of FEEDS) assert.equal(typeof DEFAULT_SETTINGS.feeds[f.id], 'boolean', f.id);
  assert.deepEqual(Object.keys(DEFAULT_SETTINGS.feeds).sort(), FEEDS.map((f) => f.id).sort());
  assert.ok(!FEEDS.some((f) => REMOVED_FEEDS.includes(f.id) || /abuse\.ch/.test(f.url || '')));
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.ok(!manifest.host_permissions.some((h) => /abuse\.ch/.test(h)));
});
