import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyQrText } from '../src/core/qr-payload.js';
// jsQR's UMD wrapper attaches to `self`, which Node lacks.
globalThis.self ??= globalThis;
const { scaledSize, decodeRgba } = await import('../src/qr/decode.js');

test('QR payload classification', () => {
  assert.deepEqual(classifyQrText('https://paypa1.test/x'), { type: 'url', url: 'https://paypa1.test/x', display: 'https://paypa1.test/x' });
  assert.deepEqual(classifyQrText('www.example.com/a'), { type: 'url', url: 'https://www.example.com/a', display: 'www.example.com/a' });
  const upi = classifyQrText('upi://pay?pa=refund@okaxis&pn=SBI%20Refund&am=4999&cu=INR');
  assert.equal(upi.type, 'upi');
  assert.equal(upi.payee, 'refund@okaxis');
  assert.equal(upi.name, 'SBI Refund');
  assert.equal(upi.amount, '4999');
  assert.equal(classifyQrText('WIFI:S:home;T:WPA;P:secret;;').type, 'text');
  assert.equal(classifyQrText('').type, 'text');
});

test('bare domains and scheme-relative payloads are analysed as URLs, shown as written', () => {
  const cases = {
    'gooogle.com': 'https://gooogle.com',
    'gooogle.com/login': 'https://gooogle.com/login',
    '//gooogle.com': 'https://gooogle.com',
    '//gooogle.com/a?b=1': 'https://gooogle.com/a?b=1',
    'paypa1.test/login': 'https://paypa1.test/login',
    'sbi-kyc.test': 'https://sbi-kyc.test',
    'HTTP://X.test': 'HTTP://X.test',
    'GOOOGLE.COM:8443/x?y=1#z': 'https://GOOOGLE.COM:8443/x?y=1#z',
    'pay.example.co.in/upi': 'https://pay.example.co.in/upi',
    'xn--80ak6aa92e.com': 'https://xn--80ak6aa92e.com',
    'аррӏе.com': 'https://аррӏе.com',
  };
  for (const [text, url] of Object.entries(cases)) {
    assert.deepEqual(classifyQrText(text), { type: 'url', url, display: text }, text);
  }
  assert.equal(classifyQrText('  gooogle.com  ').display, 'gooogle.com');
});

test('file names, numbers, prose and email addresses are not URLs', () => {
  for (const text of ['notes.txt', 'report.pdf', 'photo.png', 'setup.exe', '12.5', '3.14159', 'hello world', 'priya@example.com', 'mailto:priya@example.com', 'v1.2.3', 'a.b', '//', '//notes.txt', 'WIFI:S:home;T:WPA;P:secret;;']) {
    const r = classifyQrText(text);
    assert.equal(r.type, 'text', text);
    assert.equal(r.maybeUrl, undefined, `${text} should carry no domain-like part`);
  }
});

test('domain-like but not a clear URL: text with a host to check', () => {
  // Suffix is a real TLD but also a file extension.
  assert.deepEqual(classifyQrText('setup.zip'), { type: 'text', text: 'setup.zip', maybeUrl: 'https://setup.zip', host: 'setup.zip' });
  assert.equal(classifyQrText('cdn.setup.zip/x').type, 'url', 'with a path or subdomain it reads as a site');
  // A domain inside prose; the email address next to it is ignored.
  const r = classifyQrText('Claim your refund at paypa1.test/claim (help: desk@bank.example).');
  assert.equal(r.type, 'text');
  assert.equal(r.maybeUrl, 'https://paypa1.test/claim');
  assert.equal(r.host, 'paypa1.test');
  assert.equal(classifyQrText('Write to desk@bank.example').maybeUrl, undefined);
});

test('decoder: scaling and empty image', () => {
  assert.deepEqual(scaledSize(4096, 2048), { w: 1024, h: 512 });
  assert.deepEqual(scaledSize(300, 200), { w: 300, h: 200 });
  const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
  assert.equal(decodeRgba(blank, 64, 64), null);
});
