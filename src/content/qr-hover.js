// QR hover: when the pointer rests on an image/canvas/svg that might hold a
// QR code, decode it locally and show what it contains plus the verdict.
//  - Same-origin, data: and blob: images and canvases are read in-page via
//    an OffscreenCanvas copy (the page's own canvas is never touched).
//  - Cross-origin images are fetched as bytes by the service worker.
//  - The decoded URL is treated as data: shown as text, analysed, never opened.

import { decodeSource } from '../qr/decode.js';
import { classifyQrText } from '../core/qr-payload.js';
import { send } from '../platform/messaging.js';
import { verdictFor } from './link-scanner.js';
import { FloatingPanel } from '../ui/overlay.js';
import { renderQr } from '../ui/render.js';
import { safe, debug } from './util.js';

const HOVER_DELAY_MS = 400;
const MIN_SIDE = 48;
const MAX_CACHE = 300;

let state = null;

function candidate(target) {
  if (!(target instanceof Element)) return null;
  const el = target.closest('img, canvas, svg');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < MIN_SIDE || r.height < MIN_SIDE) return null;
  const aspect = r.width / r.height;
  if (aspect < 0.4 || aspect > 2.5) return null;
  return el;
}

function keyFor(el) {
  if (el instanceof HTMLImageElement) return `img:${el.currentSrc || el.src}`;
  return null; // canvases/svgs can change; don't cache
}

async function decodeInPage(el) {
  if (el instanceof HTMLImageElement) {
    if (!el.complete || !el.naturalWidth) await el.decode().catch(() => {});
    return decodeSource(el, el.naturalWidth, el.naturalHeight);
  }
  if (el instanceof HTMLCanvasElement) return decodeSource(el, el.width, el.height);
  // Inline SVG: rasterise a serialised copy (no external resources load).
  const xml = new XMLSerializer().serializeToString(el);
  const r = el.getBoundingClientRect();
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  return decodeSource(img, Math.max(r.width, 256), Math.max(r.height, 256));
}

// Returns { status, text? }
async function decode(el) {
  try {
    const text = await decodeInPage(el);
    if (text) send('qr-decoded').catch(() => {});
    return text ? { status: 'ok', text } : { status: 'none' };
  } catch (e) {
    if (e?.name !== 'SecurityError' || !(el instanceof HTMLImageElement)) {
      debug('qr local decode failed', e);
      return { status: 'failed' };
    }
  }
  // Tainted (cross-origin) image: ask the worker to fetch the image bytes.
  return (await send('qr-decode', { src: el.currentSrc || el.src })) || { status: 'failed' };
}

async function inspect(el) {
  const key = keyFor(el);
  let result = key && state.cache.get(key);
  if (!result) {
    result = await decode(el);
    if (key) {
      if (state.cache.size >= MAX_CACHE) state.cache.delete(state.cache.keys().next().value);
      state.cache.set(key, result);
    }
  }
  if (!state || state.current !== el) return;
  if (result.status !== 'ok') return; // no QR (or unreadable): stay quiet
  const qr = classifyQrText(result.text);
  // A bare domain is analysed with a scheme added; it is never opened or fetched.
  const target = qr.type === 'url' ? qr.url : qr.maybeUrl;
  const verdict = target ? await verdictFor(target) : null;
  if (!state || state.current !== el) return;
  state.panel.show(el.getBoundingClientRect(), renderQr({ qr, verdict }));
}

function leave() {
  if (!state) return;
  clearTimeout(state.timer);
  state.current = null;
  state.panel.hide();
}

export function start() {
  if (state) return;
  state = { panel: new FloatingPanel(), cache: new Map(), current: null, timer: null, listeners: [] };
  const on = (target, type, fn, opts) => {
    const h = safe(fn, `qr ${type}`);
    target.addEventListener(type, h, opts);
    state.listeners.push([target, type, h, opts]);
  };
  on(document, 'mouseover', (e) => {
    const el = candidate(e.target);
    if (!el || el === state.current) return;
    leave();
    state.current = el;
    state.timer = setTimeout(safe(() => state && state.current === el && inspect(el), 'qr inspect'), HOVER_DELAY_MS);
  }, { capture: true, passive: true });
  on(document, 'mouseout', (e) => {
    if (!state.current) return;
    if (e.relatedTarget instanceof Node && state.current.contains(e.relatedTarget)) return;
    if (e.target === state.current || state.current.contains(e.target)) leave();
  }, { capture: true, passive: true });
  on(window, 'scroll', leave, { capture: true, passive: true });
  on(document, 'keydown', (e) => e.key === 'Escape' && leave(), { capture: true });
  debug('qr-hover started');
}

export function stop() {
  if (!state) return;
  for (const [t, type, h, opts] of state.listeners) t.removeEventListener(type, h, opts);
  clearTimeout(state.timer);
  state.panel.destroy();
  state = null;
}
