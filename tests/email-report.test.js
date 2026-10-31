import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailKey, fnv1a, EMAIL_KEY_RE } from '../src/core/email-key.js';
import { reportableSender, canReportSender, senderDestinationUrl, REPORT_DESTINATIONS, bannerReportPlan, pickerLinks } from '../src/core/report.js';

test('emailKey: message id first, else sender + subject; stable and opaque', () => {
  const a = emailKey({ messageId: '#msg-f:1781', address: 'x@y.test', subject: 'Hi' });
  assert.match(a, EMAIL_KEY_RE);
  assert.ok(a.startsWith('m:'));
  assert.equal(a, emailKey({ messageId: '#msg-f:1781', address: 'other@z.test' }), 'id wins over sender/subject');
  const b = emailKey({ address: 'KYC@Secure-Notice.test', subject: '  Final  notice ' });
  assert.ok(b.startsWith('s:'));
  assert.equal(b, emailKey({ address: 'kyc@secure-notice.test', subject: 'Final notice' }), 'case/space-insensitive');
  assert.notEqual(b, emailKey({ address: 'kyc@secure-notice.test', subject: 'Final notice 2' }));
  assert.ok(!b.includes('kyc') && !b.includes('notice'), 'no readable address or subject');
  assert.equal(emailKey({}), null);
  assert.equal(fnv1a(''), '811c9dc5');
  assert.notEqual(fnv1a('ಕನ್ನಡ'), fnv1a('ಕನ್ನಢ'));
});

test('reportableSender: valid address, trimmed capped display name', () => {
  assert.deepEqual(reportableSender({ address: ' kyc@secure-notice.test ', displayName: '  SBI   Alerts ' }), { address: 'kyc@secure-notice.test', displayName: 'SBI Alerts' });
  assert.deepEqual(reportableSender({ address: 'a@b.test', displayName: 'a@b.test' }), { address: 'a@b.test', displayName: '' });
  assert.equal(reportableSender({ address: 'not an address' }), null);
  assert.equal(reportableSender({ address: 'a@b' }), null);
  assert.equal(reportableSender({ address: '<a@b.test>' }), null);
  assert.equal(reportableSender(null), null);
  assert.equal(reportableSender({ address: 'a@b.test', displayName: 'x'.repeat(500) }).displayName.length, 120);
});

test('canReportSender: Suspicious and High only', () => {
  const s = { address: 'a@b.test' };
  assert.equal(canReportSender({ tier: 'suspicious' }, s), true);
  assert.equal(canReportSender({ tier: 'high' }, s), true);
  assert.equal(canReportSender({ tier: 'none' }, s), false);
  assert.equal(canReportSender({ tier: 'malicious' }, s), false);
  assert.equal(canReportSender({ tier: 'high' }, { address: 'bad' }), false);
});

test('canReportSender: a "none" sender only when the user asked to report it', () => {
  const s = { address: 'a@b.test' };
  assert.equal(canReportSender({ tier: 'none' }, s, { userInitiated: true }), true);
  assert.equal(canReportSender(null, s, { userInitiated: true }), true, 'no sender verdict counts as none');
  assert.equal(canReportSender({ tier: 'suspicious' }, s, { userInitiated: true }), true);
  assert.equal(canReportSender({ tier: 'none' }, { address: 'bad' }, { userInitiated: true }), false);
});

test('bannerReportPlan: who can be reported in each tier', () => {
  const sender = { address: 'a@b.test' };
  // No warning: only "Think this is suspicious? Report"; no minimize, no inline buttons.
  let p = bannerReportPlan({ summaryTier: 'none', senderVerdict: { tier: 'none' }, sender });
  assert.deepEqual({ ...p, skipped: undefined }, { minimize: false, reportSender: false, reportMissed: true, inlineLinks: false, skipped: undefined });
  assert.deepEqual(p.skipped, { minimize: 'tier none', reportSender: 'sender tier none', inlineLinks: 'tier none' });
  // Flagged email, flagged sender: unchanged behaviour.
  for (const tier of ['suspicious', 'high']) {
    p = bannerReportPlan({ summaryTier: 'high', senderVerdict: { tier }, sender });
    assert.equal(p.minimize && p.reportSender && p.inlineLinks && !p.reportMissed, true, tier);
  }
  // Flagged links only: no sender button, still no "missed" control.
  p = bannerReportPlan({ summaryTier: 'suspicious', senderVerdict: { tier: 'none' }, sender });
  assert.equal(p.reportSender || p.reportMissed, false);
  assert.equal(p.inlineLinks, true);
  assert.equal(p.skipped.reportSender, 'sender tier none');
  // Setting off: no report controls at all; minimize stays.
  p = bannerReportPlan({ summaryTier: 'high', senderVerdict: { tier: 'high' }, sender, reportOn: false });
  assert.deepEqual([p.minimize, p.reportSender, p.inlineLinks], [true, false, false]);
  assert.equal(p.skipped.reportSender, 'setting off');
  assert.equal(bannerReportPlan({ summaryTier: 'none', sender, reportOn: false }).skipped.reportMissed, 'setting off');
  // No usable address / no key.
  assert.equal(bannerReportPlan({ summaryTier: 'none', sender: { address: '' } }).skipped.reportMissed, 'no sender address');
  assert.equal(bannerReportPlan({ summaryTier: 'high', senderVerdict: { tier: 'high' }, sender, hasKey: false }).skipped.minimize, 'no key');
});

test('pickerLinks: at most 5 distinct stripped http(s) URLs', () => {
  const links = ['https://a.example/x?token=1#f', { url: 'https://a.example/x' }, 'mailto:a@b.test', 'https://u:p@b.example/', 'http://c.example/', 'https://d.example/', 'https://e.example/', 'https://f.example/', 'https://g.example/'];
  assert.deepEqual(pickerLinks(links), ['https://a.example/x', 'https://b.example/', 'http://c.example/', 'https://d.example/', 'https://e.example/']);
  assert.deepEqual(pickerLinks(null), []);
});

test('senderDestinationUrl: fixed list only, no prefill', () => {
  for (const d of REPORT_DESTINATIONS) assert.equal(senderDestinationUrl(d.id), d.base);
  assert.equal(senderDestinationUrl('https://evil.test/'), null);
  assert.equal(senderDestinationUrl('issue'), null);
});
