import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyQrText } from '../src/core/qr-payload.js';
// jsQR's UMD wrapper attaches to `self`, which Node lacks.
globalThis.self ??= globalThis;
const { scaledSize, decodeRgba } = await import('../src/qr/decode.js');

test('QR payload classification', () => {
  assert.deepEqual(classifyQrText('https://paypa1.test/x'), { type: 'url', url: 'https://paypa1.test/x' });
  assert.deepEqual(classifyQrText('www.example.com/a'), { type: 'url', url: 'http://www.example.com/a' });
  const upi = classifyQrText('upi://pay?pa=refund@okaxis&pn=SBI%20Refund&am=4999&cu=INR');
  assert.equal(upi.type, 'upi');
  assert.equal(upi.payee, 'refund@okaxis');
  assert.equal(upi.name, 'SBI Refund');
  assert.equal(upi.amount, '4999');
  assert.equal(classifyQrText('WIFI:S:home;T:WPA;P:secret;;').type, 'text');
  assert.equal(classifyQrText('').type, 'text');
});

test('decoder: scaling and empty image', () => {
  assert.deepEqual(scaledSize(4096, 2048), { w: 1024, h: 512 });
  assert.deepEqual(scaledSize(300, 200), { w: 300, h: 200 });
  const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
  assert.equal(decodeRgba(blank, 64, 64), null);
});
