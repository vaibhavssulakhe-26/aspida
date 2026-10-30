// Cracked / pirated software category: signals, ceiling, exemptions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUrl } from '../src/core/pipeline.js';
import { parseFeed } from '../src/core/feed-parse.js';
import { WEIGHTS, THRESHOLDS, ADVICE } from '../src/scoring/weights.js';
import { score } from '../src/scoring/score.js';
import { FEEDS, feedEnabled } from '../src/config/feeds.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../src/config/settings.js';
import { makeCtx, TOP, readData } from './helpers.js';

const ctx = makeCtx();
const piracyHit = (value, source = 'Bundled pirated-software demo list') => ({ source, kind: 'host', value, category: 'piracy' });
const ids = (v) => (v?.reasons || []).map((r) => r.id);
const sw = (v) => ids(v).filter((id) => id.startsWith('software.'));

test('a listed host gets software.piracy-list, Suspicious, never Known malicious', () => {
  const v = analyzeUrl('https://crackzone-downloads.test/', ctx, [piracyHit('crackzone-downloads.test')]);
  assert.deepEqual(sw(v), ['software.piracy-list']);
  assert.equal(v.tier, 'suspicious');
  assert.ok(!ids(v).some((id) => id.startsWith('feed.')), 'piracy hits must not become feed signals');
  const r = v.reasons.find((x) => x.id === 'software.piracy-list');
  assert.equal(r.detail, 'Listed in the pirated-software category (source: Bundled pirated-software demo list)');
  assert.deepEqual(v.advice, [ADVICE['software.piracy-list']]);
});

test('advice wording: no "safe", no "illegal", no claim that the site itself has malware', () => {
  const a = ADVICE['software.piracy-list'];
  assert.doesNotMatch(a, /\bsafe\b|illegal/i);
  assert.doesNotMatch(a, /this site (has|contains|is infected)/i);
  assert.match(a, /Use the official site or a trusted store/);
});

test('one piracy keyword is not enough; two distinct ones are', () => {
  assert.deepEqual(sw(analyzeUrl('https://blog-tools.test/photoshop-crack', ctx, [])), []);
  assert.deepEqual(sw(analyzeUrl('https://blog-tools.test/page', ctx, [], { linkText: 'Office activator' })), []);
  const two = analyzeUrl('https://blog-tools.test/photoshop-crack-keygen', ctx, []);
  assert.deepEqual(sw(two), ['software.piracy-keywords']);
  assert.match(two.reasons.find((r) => r.id === 'software.piracy-keywords').evidence, /crack, keygen/);
  // Domain + link text count together.
  assert.deepEqual(sw(analyzeUrl('https://win-activator.test/', ctx, [], { linkText: 'Windows 11 full version free download' })), ['software.piracy-keywords']);
  // Same word twice is still one distinct word.
  assert.deepEqual(sw(analyzeUrl('https://crack.test/crack/crack', ctx, [])), []);
});

test('"crack the interview" style text does not fire', () => {
  for (const [u, t] of [
    ['https://careers-blog.test/crack-the-interview', 'How to crack the interview'],
    ['https://news.test/phone-unlocked-deals', 'Unlocked phones on sale'],
    ['https://cooking.test/cracked-pepper-recipes', 'Cracked pepper chicken'],
  ]) {
    assert.deepEqual(sw(analyzeUrl(u, ctx, [], { linkText: t })), [], u);
  }
});

test('risky download: executable/archive on an unknown site only', () => {
  const v = analyzeUrl('https://downloads-mirror.test/files/setup.exe', ctx, []);
  assert.deepEqual(sw(v), ['software.risky-download']);
  assert.equal(v.tier, 'none', 'low weight alone');
  for (const ext of ['msi', 'zip', 'iso', 'scr', 'apk', 'EXE']) assert.deepEqual(sw(analyzeUrl(`https://x-files.test/a.${ext}`, ctx, [])), ['software.risky-download'], ext);
  assert.deepEqual(sw(analyzeUrl('https://x-files.test/setup.exe.html', ctx, [])), []);
  assert.deepEqual(sw(analyzeUrl('https://x-files.test/readme.pdf', ctx, [])), []);
});

test('keywords + risky download together reach Suspicious', () => {
  const v = analyzeUrl('https://softvault-mirror.test/photoshop-crack-keygen.exe', ctx, []);
  assert.deepEqual(sw(v).sort(), ['software.piracy-keywords', 'software.risky-download']);
  assert.equal(v.tier, 'suspicious');
});

test('ceiling: the software category alone never reaches High risk or Known malicious', () => {
  const ws = ['software.piracy-list', 'software.piracy-keywords', 'software.risky-download'].map((id) => WEIGHTS[id]);
  assert.ok(WEIGHTS['software.piracy-list'] >= THRESHOLDS.suspicious && WEIGHTS['software.piracy-list'] < THRESHOLDS.high);
  assert.ok(ws.reduce((a, b) => a + b, 0) < THRESHOLDS.high, 'all three together must stay below High');
  const all = score(['software.piracy-list', 'software.piracy-keywords', 'software.risky-download'].map((id) => ({ id, category: 'software', weight: WEIGHTS[id], evidence: 'x', detail: '' })));
  assert.equal(all.tier, 'suspicious');
  const v = analyzeUrl('https://crackzone-downloads.test/photoshop-crack-keygen.exe', ctx, [piracyHit('crackzone-downloads.test')]);
  assert.equal(sw(v).length, 3);
  assert.equal(v.tier, 'suspicious');
});

test('top-10k and allowlisted hosts are never flagged', () => {
  const big = TOP.slice(0, 200).map((d) => `https://${d}/photoshop-crack-keygen-full-version-free-download.exe`);
  for (const u of big) {
    const host = new URL(u).hostname;
    assert.deepEqual(sw(analyzeUrl(u, ctx, [piracyHit(host)], { linkText: 'crack keygen' })), [], u);
  }
  const allow = makeCtx({ allowlist: ['crackzone-downloads.test'] });
  const v = analyzeUrl('https://crackzone-downloads.test/x-crack-keygen.exe', allow, [piracyHit('crackzone-downloads.test')]);
  assert.equal(v.tier, 'none');
  assert.deepEqual(sw(v), []);
});

test('the switch turns the whole category off', () => {
  const off = makeCtx({ disabledChecks: ['software'] });
  const v = analyzeUrl('https://crackzone-downloads.test/photoshop-crack-keygen.exe', off, [piracyHit('crackzone-downloads.test')]);
  assert.deepEqual(sw(v), []);
  assert.equal(DEFAULT_SETTINGS.softwareChecks, true);
  const piracyFeeds = FEEDS.filter((f) => f.category === 'piracy');
  assert.ok(piracyFeeds.length >= 2);
  for (const f of piracyFeeds) {
    assert.equal(f.requires, 'softwareChecks');
    assert.ok(feedEnabled(f, DEFAULT_SETTINGS), f.id);
    assert.ok(!feedEnabled(f, mergeSettings({ softwareChecks: false })), `${f.id} must not download when the switch is off`);
  }
});

test('feed lists: bundled demo list is reserved-only; HaGeZi format parses', () => {
  const sample = parseFeed('domain-list', readData('data/sample-piracy.txt'));
  assert.ok(sample.hosts.length >= 3);
  for (const h of sample.hosts) assert.match(h, /\.test$/);
  const hz = parseFeed('domain-list', '# Title: HaGeZi\n# Syntax: Domains (without subdomains)\n#\nexample-warez.top\nbad line with spaces\nfitgirl-repacks.example\n');
  assert.deepEqual(hz.hosts, ['example-warez.top', 'fitgirl-repacks.example']);
  // Piracy feeds are on hosts already allowed for the threat feeds.
  for (const f of FEEDS.filter((x) => x.category === 'piracy' && x.url)) assert.match(f.url, /^https:\/\/raw\.githubusercontent\.com\//);
});
