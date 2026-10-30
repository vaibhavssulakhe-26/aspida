// QR decoding from raw pixels, shared by the content script (same-origin
// images/canvases) and the service worker (cross-origin images).
// Uses the vendored jsQR; no network, no chrome.*.
import '../../vendor/jsqr/jsQR.js';

const MAX_SIDE = 1024; // downscale big images; QR codes survive this fine

export function scaledSize(w, h) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

// Draw any CanvasImageSource onto an OffscreenCanvas and decode. Throws a
// SecurityError if the source is cross-origin tainted; callers handle that.
export function decodeSource(source, width, height) {
  const { w, h } = scaledSize(width, height);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return decodeRgba(data, w, h);
}

export function decodeRgba(data, w, h) {
  const result = self.jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
  return result && typeof result.data === 'string' && result.data ? result.data : null;
}
