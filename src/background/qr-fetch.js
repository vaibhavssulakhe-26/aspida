// Cross-origin QR images: the content script can't read their pixels, so
// the worker fetches the IMAGE bytes (no cookies, no referrer), decodes them
// locally and returns the text. The decoded URL is never fetched or opened.
// Host access for this comes from the content-script match patterns
// (http/https), which Chrome also grants to the extension's own fetches.

import { decodeSource } from '../qr/decode.js';
import { bumpStat } from './analyzer.js';

const MAX_BYTES = 8 * 1024 * 1024;

// Returns { status: 'ok', text } | { status: 'none' | 'unsupported' | 'failed', detail? }
export async function decodeQrFromUrl(src) {
  if (typeof src !== 'string' || !/^(https?:|data:image\/)/i.test(src)) return { status: 'unsupported' };
  let res;
  try {
    res = await fetch(src, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'force-cache', redirect: 'follow' });
  } catch (e) {
    return { status: 'failed', detail: String(e?.message || e) };
  }
  if (!res.ok) return { status: 'failed', detail: `HTTP ${res.status}` };
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return { status: 'unsupported', detail: 'image too large' };
  const blob = await res.blob();
  if (blob.size > MAX_BYTES) return { status: 'unsupported', detail: 'image too large' };
  if (!blob.type.startsWith('image/') || blob.type.includes('svg')) return { status: 'unsupported', detail: blob.type || 'not an image' };
  let bmp;
  try {
    bmp = await createImageBitmap(blob);
  } catch {
    return { status: 'failed', detail: 'could not decode image' };
  }
  try {
    const text = decodeSource(bmp, bmp.width, bmp.height);
    if (!text) return { status: 'none' };
    await bumpStat('qrDecoded');
    return { status: 'ok', text };
  } finally {
    bmp.close();
  }
}
