// Interface string tables (English source, Kannada draft).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import en from '../src/config/strings/en.js';
import kn from '../src/config/strings/kn.js';
import { t, translate, setLanguage, getLanguage, LANGUAGES } from '../src/config/strings/index.js';
import { TIERS, ADVICE_SIGNALS } from '../src/scoring/weights.js';
import { DEFAULT_SETTINGS } from '../src/config/settings.js';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every English key exists in Kannada, and no extra keys', () => {
  const missing = Object.keys(en).filter((k) => !Object.hasOwn(kn, k));
  assert.deepEqual(missing, [], `missing in kn.js: ${missing.join(', ')}`);
  const extra = Object.keys(kn).filter((k) => !Object.hasOwn(en, k));
  assert.deepEqual(extra, [], `unknown keys in kn.js: ${extra.join(', ')}`);
});

test('translations keep placeholders, are non-empty, and keep the product name', () => {
  for (const [k, v] of Object.entries(kn)) {
    assert.ok(typeof v === 'string' && v.trim(), k);
    assert.deepEqual(placeholders(v), placeholders(en[k]), `placeholders differ for ${k}`);
    if (/\bAspida\b/.test(en[k])) assert.match(v, /\bAspida\b/, `${k}: "Aspida" must stay untranslated`);
  }
});

test('never "safe": English nor Kannada (ಸುರಕ್ಷಿತ)', () => {
  for (const v of Object.values(en)) assert.doesNotMatch(v, /\bsafe\b/i, v);
  for (const v of Object.values(kn)) assert.doesNotMatch(v, /ಸುರಕ್ಷಿತ/, v);
});

test('tier names, toolbar titles and advice exist for every tier/signal', () => {
  for (const tier of TIERS) {
    assert.ok(en[`tier.${tier}`] && kn[`tier.${tier}`], tier);
    assert.ok(en[`toolbar.${tier}`] && kn[`toolbar.${tier}`], tier);
  }
  for (const id of ADVICE_SIGNALS) assert.ok(en[`advice.${id}`] && kn[`advice.${id}`], id);
  assert.equal(en['tier.none'], 'No known threats found');
});

test('t(): current language, English fallback, placeholders', () => {
  assert.equal(DEFAULT_SETTINGS.uiLanguage, 'en');
  assert.deepEqual(LANGUAGES.map((l) => l.code), ['en', 'kn']);
  try {
    assert.equal(setLanguage('kn'), 'kn');
    assert.equal(t('tier.high'), kn['tier.high']);
    assert.equal(t('banner.checkedMany', { n: 3 }), kn['banner.checkedMany'].replace('{n}', '3'));
    assert.equal(setLanguage('fr'), 'en', 'unknown language falls back to English');
    assert.equal(getLanguage(), 'en');
  } finally {
    setLanguage('en');
  }
  assert.equal(translate('kn', 'no.such.key'), 'no.such.key');
  assert.equal(translate('en', 'options.remove', { d: 'a.example' }), 'Remove a.example');
  assert.equal(translate('en', 'options.remove'), 'Remove {d}', 'missing var left visible');
});

test('the Kannada review document lists every key', () => {
  const doc = readFileSync(new URL('../docs/KANNADA_STRINGS_REVIEW.md', import.meta.url), 'utf8');
  for (const k of Object.keys(en)) assert.ok(doc.includes(`\`${k}\``), `review doc lacks ${k}`);
  assert.match(doc, /DRAFT/);
});
