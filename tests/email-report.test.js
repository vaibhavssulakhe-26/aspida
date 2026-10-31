import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailKey, fnv1a, EMAIL_KEY_RE } from '../src/core/email-key.js';
import { reportableSender, canReportSender, senderDestinationUrl, REPORT_DESTINATIONS } from '../src/core/report.js';

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

test('senderDestinationUrl: fixed list only, no prefill', () => {
  for (const d of REPORT_DESTINATIONS) assert.equal(senderDestinationUrl(d.id), d.base);
  assert.equal(senderDestinationUrl('https://evil.test/'), null);
  assert.equal(senderDestinationUrl('issue'), null);
});
