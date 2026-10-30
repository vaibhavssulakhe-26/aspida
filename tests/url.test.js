import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl, registrableDomain, feedUrlKey, hostLookupChain, punycodeDecode, toUnicodeHost } from '../src/core/url.js';

test('parseUrl rejects non-http schemes', () => {
  assert.equal(parseUrl('javascript:alert(1)'), null);
  assert.equal(parseUrl('mailto:a@b.com'), null);
  assert.equal(parseUrl('not a url'), null);
  assert.equal(parseUrl(''), null);
});

test('parseUrl normalises host', () => {
  const u = parseUrl('HTTPS://WWW.Example.COM./a?b=1#c');
  assert.equal(u.host, 'www.example.com');
  assert.equal(u.registrable, 'example.com');
  assert.equal(u.scheme, 'https');
});

test('registrableDomain handles multi-part and hosting suffixes', () => {
  assert.equal(registrableDomain('retail.onlinesbi.sbi'), 'onlinesbi.sbi');
  assert.equal(registrableDomain('www.sbi.co.in'), 'sbi.co.in');
  assert.equal(registrableDomain('a.b.amazon.co.uk'), 'amazon.co.uk');
  assert.equal(registrableDomain('evil-sbi.vercel.app'), 'evil-sbi.vercel.app');
  assert.equal(registrableDomain('x.y.github.io'), 'y.github.io');
  assert.equal(registrableDomain('vercel.app'), 'vercel.app');
  assert.equal(registrableDomain('192.168.1.1'), '192.168.1.1');
});

test('IP hosts detected including integer form', () => {
  assert.equal(parseUrl('http://3232235777/').isIp, true);
  assert.equal(parseUrl('http://[::1]/').isIp, true);
  assert.equal(parseUrl('http://example.com/').isIp, false);
});

test('feedUrlKey normalises scheme, slash, fragment, case', () => {
  assert.equal(feedUrlKey('https://EVIL.com/Login/#x'), 'evil.com/Login');
  assert.equal(feedUrlKey('http://evil.com/'), 'evil.com');
  assert.equal(feedUrlKey('http://evil.com:8080/a?q=1'), 'evil.com:8080/a?q=1');
  assert.equal(feedUrlKey('ftp://evil.com/'), null);
});

test('hostLookupChain stops at registrable domain', () => {
  assert.deepEqual(hostLookupChain('a.b.evil.co.in'), ['a.b.evil.co.in', 'b.evil.co.in', 'evil.co.in']);
  assert.deepEqual(hostLookupChain('evil.com'), ['evil.com']);
});

test('punycode decode', () => {
  assert.equal(punycodeDecode('mnchen-3ya'), 'münchen');
  assert.equal(toUnicodeHost('xn--80ak6aa92e.com'), 'аррӏе.com');
  assert.equal(toUnicodeHost('example.com'), 'example.com');
});

import { unwrapRedirect } from '../src/core/url.js';

test('unwrapRedirect reads tracking wrappers locally', () => {
  assert.deepEqual(unwrapRedirect('https://l.instagram.com/?u=https%3A%2F%2Fsbi-kyc.test%2Fx&e=AT0'), { url: 'https://sbi-kyc.test/x', via: 'l.instagram.com' });
  assert.deepEqual(unwrapRedirect('https://www.google.com/url?q=https://evil.test/&sa=D'), { url: 'https://evil.test/', via: 'www.google.com' });
  assert.equal(unwrapRedirect('https://l.instagram.com/?u=javascript:alert(1)'), null);
  assert.equal(unwrapRedirect('https://www.google.com/search?q=https://x.test/'), null);
  assert.equal(unwrapRedirect('https://example.com/?u=https://x.test/'), null);
});
