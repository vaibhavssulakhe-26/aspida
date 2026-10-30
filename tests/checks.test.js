import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl } from '../src/core/url.js';
import { makeCtx } from './helpers.js';
import * as typosquat from '../src/checks/typosquat.js';
import * as homoglyph from '../src/checks/homoglyph-idn.js';
import * as brand from '../src/checks/brand-claim.js';
import * as structure from '../src/checks/url-structure.js';
import * as shortener from '../src/checks/shortener.js';
import * as feed from '../src/checks/feed-match.js';
import * as sender from '../src/checks/sender-checks.js';
import { URL_CHECKS, SENDER_CHECKS } from '../src/checks/index.js';
import { WEIGHTS } from '../src/scoring/weights.js';

const ctx = makeCtx();
const run = (mod, href) => mod.check({ url: parseUrl(href), feedHits: [] }, ctx);
const ids = (signals) => signals.map((s) => s.id);

test('every signal has the documented shape', () => {
  const s = run(structure, 'http://192.168.0.1:8080/login');
  assert.ok(s.length > 0);
  for (const sig of s) {
    assert.deepEqual(Object.keys(sig).sort(), ['category', 'detail', 'evidence', 'id', 'weight']);
    assert.equal(sig.weight, WEIGHTS[sig.id]);
    assert.equal(typeof sig.evidence, 'string');
  }
});

test('registry modules expose id + check', () => {
  for (const m of [...URL_CHECKS, ...SENDER_CHECKS]) {
    assert.equal(typeof m.id, 'string');
    assert.equal(typeof m.check, 'function');
  }
});

test('typosquat: visual swaps', () => {
  assert.deepEqual(ids(run(typosquat, 'https://paypa1.com/')), ['typosquat.visual_swap']);
  assert.deepEqual(ids(run(typosquat, 'https://arnazon.com/')), ['typosquat.visual_swap']);
  assert.deepEqual(ids(run(typosquat, 'https://g00gle.com/')), ['typosquat.visual_swap']);
  assert.match(run(typosquat, 'https://paypa1.com/')[0].detail, /paypal\.com/);
});

test('typosquat: edit distance', () => {
  assert.deepEqual(ids(run(typosquat, 'https://flipkarrt.com/')), ['typosquat.edit_distance']);
  assert.deepEqual(ids(run(typosquat, 'https://phonepay.com/')), []); // distance 2 on a 7-char name: allowed through
  assert.deepEqual(ids(run(typosquat, 'https://phonpe.com/')), ['typosquat.edit_distance']);
  assert.deepEqual(ids(run(typosquat, 'https://hdfcbnak.com/')), ['typosquat.edit_distance']);
  assert.deepEqual(ids(run(typosquat, 'https://pay-pal.com/')), ['typosquat.edit_distance']);
});

test('typosquat: never flags well-known domains', () => {
  for (const d of ['google.com', 'amazon.in', 'paypal.com', 'sbi.co.in', 'flipkart.com', 'github.com', 'reddit.com']) {
    assert.deepEqual(run(typosquat, `https://${d}/`), [], d);
  }
});

test('typosquat: editDistance basics', () => {
  assert.equal(typosquat.editDistance('paypal', 'paypal'), 0);
  assert.equal(typosquat.editDistance('paypal', 'paypla'), 1); // transposition
  assert.equal(typosquat.editDistance('kitten', 'sitting'), 3);
  assert.ok(typosquat.editDistance('abcdef', 'uvwxyz', 1) > 1);
});

test('homoglyph: Cyrillic lookalike of apple.com', () => {
  const s = run(homoglyph, 'https://xn--80ak6aa92e.com/');
  assert.ok(ids(s).includes('homoglyph.lookalike'));
  assert.ok(ids(s).includes('idn.punycode'));
});

test('homoglyph: mixed script label', () => {
  // "pаypal" with Cyrillic а
  const host = new URL('https://pаypal.com/').hostname;
  const s = run(homoglyph, `https://${host}/`);
  assert.ok(ids(s).includes('homoglyph.mixed_script'));
  assert.ok(ids(s).includes('homoglyph.lookalike'));
});

test('homoglyph: legit IDN is only informational', () => {
  const host = new URL('https://münchen.de/').hostname;
  assert.deepEqual(ids(run(homoglyph, `https://${host}/`)), ['idn.punycode']);
});

test('brand claim: domain, subdomain, path', () => {
  const d = run(brand, 'https://sbi-login.xyz/');
  assert.deepEqual(ids(d), ['brand.in_domain']);
  assert.match(d[0].detail, /claims to be SBI but the domain is not sbi\.co\.in/);
  assert.deepEqual(ids(run(brand, 'https://paypal.com.verify-acct.ru/')), ['brand.in_subdomain']);
  assert.deepEqual(ids(run(brand, 'https://hdfcbank-kyc.vercel.app/')), ['brand.in_domain']);
  assert.deepEqual(ids(run(brand, 'https://paytmkyc.in/')), ['brand.in_domain']);
  assert.deepEqual(ids(run(brand, 'https://random-site.org/irctc/login')), ['brand.in_path']);
});

test('brand claim: no false positives on owners or unrelated words', () => {
  assert.deepEqual(run(brand, 'https://www.onlinesbi.sbi/'), []);
  assert.deepEqual(run(brand, 'https://www.sbi.co.in/'), []);
  assert.deepEqual(run(brand, 'https://pineapple-recipes.org/'), []);
  assert.deepEqual(run(brand, 'https://sbin.example.org/'), []); // "sbin" is not "sbi"
  assert.deepEqual(run(brand, 'https://myblog.org/posts/amazonia-rainforest'), []);
});

test('url structure signals', () => {
  assert.ok(ids(run(structure, 'http://10.0.0.1/')).includes('url.ip_host'));
  assert.ok(ids(run(structure, 'https://www.google.com@evil.tld/')).includes('url.at_sign'));
  assert.equal(run(structure, 'https://www.google.com@evil.tld/').find((s) => s.id === 'url.at_sign').evidence, 'www.google.com@');
  assert.ok(ids(run(structure, 'https://a.b.c.d.evil.com/')).includes('url.many_subdomains'));
  assert.ok(ids(run(structure, 'https://cheap.xyz/')).includes('url.odd_tld'));
  assert.ok(ids(run(structure, `https://e.com/${'a'.repeat(250)}`)).includes('url.long'));
  assert.ok(ids(run(structure, 'https://e.com:8443/')).includes('url.nonstandard_port'));
  assert.ok(ids(run(structure, 'https://e.com/account/verify')).includes('url.credential_words'));
  assert.deepEqual(run(structure, 'https://example.com/about'), []);
});

test('shortener signal', () => {
  assert.deepEqual(ids(run(shortener, 'https://bit.ly/abc')), ['shortener.known']);
  assert.deepEqual(run(shortener, 'https://example.com/'), []);
});

test('feed match turns hits into signals', () => {
  const url = parseUrl('https://evil.com/x');
  const s = feed.check({ url, feedHits: [{ source: 'openphish', kind: 'url', value: 'evil.com/x' }, { source: 'phishing.database', kind: 'host', value: 'evil.com' }] });
  assert.deepEqual(ids(s), ['feed.url_match', 'feed.host_match']);
  assert.match(s[0].detail, /openphish/);
});

test('sender: freemail brand claim', () => {
  const s = sender.check({ displayName: 'SBI Customer Care', address: 'sbi.alerts2024@gmail.com' }, ctx);
  assert.deepEqual(ids(s), ['sender.freemail_brand']);
});

test('sender: display brand mismatch + lookalike', () => {
  const s = sender.check({ displayName: 'PayPal Service', address: 'service@paypa1.com' }, ctx);
  assert.ok(ids(s).includes('sender.display_brand_mismatch'));
  assert.ok(ids(s).includes('sender.lookalike_domain'));
});

test('sender: display name shows another address', () => {
  const s = sender.check({ displayName: 'support@hdfcbank.com', address: 'x@mailer-hub.ru' }, ctx);
  assert.ok(ids(s).includes('sender.display_name_email_mismatch'));
});

test('sender: reply-to mismatch', () => {
  const s = sender.check({ displayName: 'Alice', address: 'alice@company.com', replyTo: 'alice@other-domain.net' }, ctx);
  assert.deepEqual(ids(s), ['sender.reply_to_mismatch']);
});

test('sender: legit brand mail is clean', () => {
  assert.deepEqual(sender.check({ displayName: 'Amazon.in', address: 'order-update@amazon.in', replyTo: 'no-reply@amazon.in' }, ctx), []);
  assert.deepEqual(sender.check({ displayName: 'HDFC Bank InstaAlerts', address: 'alerts@hdfcbank.net' }, ctx).map((s) => s.id), ['sender.display_brand_mismatch']);
  assert.deepEqual(sender.check({ displayName: 'Priya', address: 'priya@gmail.com' }, ctx), []);
});

import * as linkText from '../src/checks/link-text.js';

test('link text mismatch', () => {
  const s = linkText.check({ url: parseUrl('https://evil-host.ru/login'), linkText: 'www.hdfcbank.com' });
  assert.deepEqual(ids(s), ['link.text_mismatch']);
  assert.equal(s[0].evidence, 'www.hdfcbank.com');
  assert.match(s[0].detail, /shows hdfcbank\.com but it opens evil-host\.ru/);
  assert.deepEqual(linkText.check({ url: parseUrl('https://hdfcbank.com/x'), linkText: 'https://www.hdfcbank.com/' }), []);
  assert.deepEqual(linkText.check({ url: parseUrl('https://evil.ru/'), linkText: 'Click here' }), []);
  assert.deepEqual(linkText.check({ url: parseUrl('https://evil.ru/'), linkText: undefined }), []);
  assert.equal(linkText.hostShownIn('Visit paypal.com today'), null); // sentences are not addresses
});

test('homoglyph: imitation of a well-known name on another TLD', () => {
  const host = new URL('https://аррӏе.ru/').hostname;
  const s = run(homoglyph, `https://${host}/`);
  assert.ok(ids(s).includes('homoglyph.lookalike'));
  assert.match(s.find((x) => x.id === 'homoglyph.lookalike').detail, /apple\.com/);
});

test('brand claim: visually swapped brand inside a longer name', () => {
  assert.deepEqual(ids(run(brand, 'https://arnazon-orders.test/verify')), ['brand.in_domain']);
  assert.deepEqual(ids(run(brand, 'https://paypa1-secure.test/')), ['brand.in_domain']);
  assert.deepEqual(ids(run(brand, 'https://jio-free-recharge.test/claim')), ['brand.in_domain']);
});
