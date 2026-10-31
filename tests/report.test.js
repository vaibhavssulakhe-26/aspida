// "Report this link": URL stripping and destination building (pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReport, reportableUrl, destinationUrl, wrongWarningText, wrongWarningIssueUrl, REPORT_DESTINATIONS } from '../src/core/report.js';

test('query string and fragment are removed by default; credentials always', () => {
  assert.equal(reportableUrl('https://paypa1.test/login?email=priya%40example.com&token=abc#step2'), 'https://paypa1.test/login');
  assert.equal(reportableUrl('https://paypa1.test/login?email=a&t=b#x', { strip: false }), 'https://paypa1.test/login?email=a&t=b#x');
  assert.equal(reportableUrl('https://user:secret@paypa1.test/a?x=1', { strip: false }), 'https://paypa1.test/a?x=1');
  assert.equal(reportableUrl('https://user:secret@paypa1.test/a?x=1'), 'https://paypa1.test/a');
  assert.equal(reportableUrl('http://192.0.2.10:8080/p/?q#'), 'http://192.0.2.10:8080/p/');
  assert.equal(reportableUrl('  https://PAYPA1.test  '), 'https://paypa1.test/');
  // The "@" trick keeps the real host, not the decoy before "@".
  assert.equal(reportableUrl('https://www.google.com@192.0.2.10/login?x=1'), 'https://192.0.2.10/login');
});

test('only http(s) URLs can be reported', () => {
  for (const u of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'chrome://settings', 'not a url', '', null]) {
    assert.equal(reportableUrl(u), null, String(u));
    assert.equal(destinationUrl('safebrowsing', u), null, String(u));
  }
});

test('report button only for suspicious / high / malicious', () => {
  const v = (tier, subject = 'https://paypa1.test/') => ({ tier, subject });
  assert.ok(canReport(v('suspicious')) && canReport(v('high')) && canReport(v('malicious')));
  assert.ok(!canReport(v('none')));
  assert.ok(!canReport(v('high', 'mailto:a@b.test')));
  assert.ok(!canReport(null));
});

test('destinations: fixed list, Safe Browsing prefilled, others plain', () => {
  const t = 'https://paypa1.test/login';
  assert.deepEqual(destinationUrl('safebrowsing', t), { url: 'https://safebrowsing.google.com/safebrowsing/report_phish/?url=https%3A%2F%2Fpaypa1.test%2Flogin', prefilled: true });
  assert.deepEqual(destinationUrl('netcraft', t), { url: 'https://report.netcraft.com/report', prefilled: false });
  assert.deepEqual(destinationUrl('cybercrime', t), { url: 'https://cybercrime.gov.in/', prefilled: false });
  assert.equal(destinationUrl('https://evil.example/', t), null, 'unknown ids rejected');
  assert.equal(destinationUrl('__proto__', t), null);
  for (const d of REPORT_DESTINATIONS) assert.match(d.base, /^https:\/\//);
});

test('wrong-warning text and issue link carry the URL and signal ids only', () => {
  const verdict = { tier: 'high', reasons: [{ id: 'typosquat.visual_swap' }, { id: 'brand.in_domain' }, { id: 'brand.in_domain' }] };
  const text = wrongWarningText('https://paypa1.test/', verdict);
  assert.equal(text, 'Aspida: possible wrong warning\nURL: https://paypa1.test/\nTier: high\nSignals: typosquat.visual_swap, brand.in_domain');
  const issue = new URL(wrongWarningIssueUrl('https://paypa1.test/', verdict));
  assert.equal(issue.origin + issue.pathname, 'https://github.com/vaibhavssulakhe-26/aspida/issues/new');
  assert.equal(issue.searchParams.get('title'), 'Wrong warning: paypa1.test');
  assert.ok(issue.searchParams.get('body').startsWith(text));
});
