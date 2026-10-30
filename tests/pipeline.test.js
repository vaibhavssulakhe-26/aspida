import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUrl, analyzeSender, combine } from '../src/core/pipeline.js';
import { score } from '../src/scoring/score.js';
import { WEIGHTS, THRESHOLDS, TIERS } from '../src/scoring/weights.js';
import en from '../src/config/strings/en.js';
import { makeCtx, TOP, readData } from './helpers.js';

const ctx = makeCtx();

test('wording never says "safe"', () => {
  for (const tier of TIERS) assert.doesNotMatch(en[`tier.${tier}`], /safe/i);
  assert.equal(analyzeUrl('https://example.com/', ctx).label, 'No known threats found');
});

test('score: tiers from thresholds, feed forces malicious', () => {
  const s = (id, category = 'x') => ({ id, category, weight: WEIGHTS[id], evidence: id, detail: '' });
  assert.equal(score([]).tier, 'none');
  assert.equal(score([s('url.odd_tld')]).tier, 'none');
  assert.equal(score([s('url.ip_host')]).tier, 'suspicious');
  assert.equal(score([s('typosquat.visual_swap')]).tier, 'high');
  assert.equal(score([s('feed.host_match', 'feed')]).tier, 'malicious');
  assert.ok(THRESHOLDS.suspicious < THRESHOLDS.high);
});

test('score: duplicate ids count once, reasons sorted by weight', () => {
  const a = { id: 'url.odd_tld', category: 'structure', weight: 15, evidence: '.xyz', detail: '' };
  const b = { id: 'url.ip_host', category: 'structure', weight: 40, evidence: '1.2.3.4', detail: '' };
  const r = score([a, a, b]);
  assert.equal(r.score, 55);
  assert.equal(r.reasons[0].id, 'url.ip_host');
  assert.equal(r.reasons.length, 2);
});

test('pipeline: classic phish examples', () => {
  assert.equal(analyzeUrl('https://sbi-login.xyz/', ctx).tier, 'high');
  assert.equal(analyzeUrl('https://paypa1.com/signin', ctx).tier, 'high');
  assert.equal(analyzeUrl('https://xn--80ak6aa92e.com/', ctx).tier, 'high');
  assert.equal(analyzeUrl('http://192.168.4.20/hdfc/netbanking', ctx).tier, 'suspicious');
  assert.equal(analyzeUrl('https://example.com/', ctx, [{ source: 'openphish', kind: 'url', value: 'example.com' }]).tier, 'malicious');
});

test('pipeline: verdict carries cited evidence', () => {
  const v = analyzeUrl('https://sbi-login.xyz/', ctx);
  assert.ok(v.reasons.length > 0);
  assert.ok(v.reasons.every((r) => r.evidence && r.detail));
  assert.equal(v.subject, 'https://sbi-login.xyz/');
});

test('pipeline: non-http returns null', () => {
  assert.equal(analyzeUrl('javascript:void(0)', ctx), null);
});

test('pipeline: allowlist suppresses everything', () => {
  const c = makeCtx({ allowlist: ['sbi-login.xyz'] });
  const v = analyzeUrl('https://www.sbi-login.xyz/login', c, [{ source: 'openphish', kind: 'host', value: 'sbi-login.xyz' }]);
  assert.equal(v.tier, 'none');
  assert.equal(v.allowlisted, true);
});

test('pipeline: well-known domains ignore host feed hits but honour exact URL hits', () => {
  assert.equal(analyzeUrl('https://docs.google.com/forms/x', ctx, [{ source: 'f', kind: 'host', value: 'docs.google.com' }]).tier, 'none');
  assert.equal(analyzeUrl('https://docs.google.com/forms/x', ctx, [{ source: 'f', kind: 'url', value: 'docs.google.com/forms/x' }]).tier, 'malicious');
});

test('false positives: no top-10k domain is flagged', () => {
  const flagged = [];
  for (const d of TOP) {
    for (const href of [`https://${d}/`, `https://www.${d}/login`]) {
      const v = analyzeUrl(href, ctx);
      if (v && v.tier !== 'none') flagged.push(`${href} ${v.tier}`);
    }
  }
  assert.deepEqual(flagged, []);
});

test('false positives: benign fixture URLs stay clean', () => {
  const lines = readData('tests/fixtures/benign-urls.txt').split('\n').filter((l) => l && !l.startsWith('#'));
  const flagged = lines.map((u) => analyzeUrl(u, ctx)).filter((v) => v.tier !== 'none').map((v) => `${v.subject} ${v.tier} ${v.reasons.map((r) => r.id)}`);
  assert.deepEqual(flagged, []);
});

test('true positives: phishing fixture URLs are flagged', () => {
  const lines = readData('tests/fixtures/phish-urls.txt').split('\n').filter((l) => l && !l.startsWith('#'));
  const missed = lines.map((u) => analyzeUrl(u, ctx)).filter((v) => v.tier === 'none').map((v) => v.subject);
  assert.deepEqual(missed, []);
});

test('sender pipeline and combine', () => {
  const v = analyzeSender({ displayName: 'SBI Alerts', address: 'sbi.kyc@gmail.com' }, ctx);
  assert.equal(v.tier, 'suspicious');
  assert.equal(analyzeSender({ displayName: 'x', address: 'not-an-address' }, ctx), null);
  const c = combine([v, analyzeUrl('https://paypa1.com/', ctx), null]);
  assert.equal(c.tier, 'high');
  assert.equal(c.count, 2);
});

test('sender feed host hit is malicious', () => {
  const v = analyzeSender({ displayName: 'x', address: 'a@evil-mailer.ru' }, ctx, [{ source: 'f', kind: 'host', value: 'evil-mailer.ru' }]);
  assert.equal(v.tier, 'malicious');
});

test('pipeline: link text mismatch only with linkText, suppressed on well-known hrefs', () => {
  assert.equal(analyzeUrl('https://evil-host.ru/', ctx).tier, 'none');
  assert.equal(analyzeUrl('https://evil-host.ru/', ctx, [], { linkText: 'sbi.co.in' }).tier, 'suspicious');
  assert.equal(analyzeUrl('https://x.com/foo', ctx, [], { linkText: 'twitter.com' }).tier, 'none');
});

test('pipeline: analyses the real destination behind a redirect wrapper', () => {
  const v = analyzeUrl('https://l.instagram.com/?u=https%3A%2F%2Fpaypa1.com%2Flogin', ctx);
  assert.equal(v.tier, 'high');
  assert.equal(v.via, 'l.instagram.com');
  assert.equal(v.registrable, 'paypa1.com');
});

test('sender scenarios used by the Gmail demo', () => {
  const phish = analyzeSender({ displayName: 'HDFC Bank', address: 'security@hdfcbank-alerts.test', replyTo: 'hdfc.kyc.desk@gmail.com' }, ctx);
  // Domain brand == display brand, so it is reported once (display mismatch), not twice.
  assert.deepEqual(phish.reasons.map((r) => r.id).sort(), ['sender.display_brand_mismatch', 'sender.reply_to_mismatch']);
  assert.equal(phish.tier, 'high');
  assert.equal(analyzeSender({ displayName: 'PayPal Service', address: 'service@paypa1.test' }, ctx).tier, 'high');
  assert.equal(analyzeSender({ displayName: 'SBI Alerts', address: 'sbi.alerts.kyc@gmail.com' }, ctx).tier, 'suspicious');
  assert.equal(analyzeSender({ displayName: 'Amazon.in', address: 'no-reply@amazon.in' }, ctx).tier, 'none');
  assert.equal(analyzeSender({ displayName: 'Priya Sharma', address: 'priya@example.org' }, ctx).tier, 'none');
});
