// Page-level verdict cache + batched requests to the service worker.
// Shared by the hover tooltip, chat badges and Gmail. Lives for the page's
// lifetime only (content-script memory, not the service worker).

import { send } from '../platform/messaging.js';
import { debug } from './util.js';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 120;
const MAX_PER_PAGE = 2000; // hard cap on distinct links analysed per page

const cache = new Map(); // key -> verdict | Promise<verdict>
let queue = []; // { key, item, resolve }
let timer = null;

const keyOf = (url, text) => `${url}\n${text || ''}`;

async function flush() {
  timer = null;
  const batch = queue.splice(0, BATCH_SIZE);
  if (queue.length) timer = setTimeout(flush, BATCH_DELAY_MS);
  if (!batch.length) return;
  let results = null;
  try {
    results = await send('analyze-urls', { items: batch.map((b) => b.item) });
  } catch (e) {
    debug('analyze-urls failed', e);
  }
  batch.forEach((b, i) => {
    const v = results?.[i] ?? null;
    if (v) cache.set(b.key, v);
    else cache.delete(b.key); // allow a retry later
    b.resolve(v);
  });
}

// Returns a Promise<verdict|null>. Cached results resolve immediately.
export function verdictFor(url, text) {
  const key = keyOf(url, text);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  if (cache.size >= MAX_PER_PAGE) return Promise.resolve(null);
  const p = new Promise((resolve) => {
    queue.push({ key, item: { url, text }, resolve });
    if (!timer) timer = setTimeout(flush, BATCH_DELAY_MS);
  });
  cache.set(key, p);
  return p;
}

// Synchronous peek: the verdict if already known, else undefined.
export function cachedVerdict(url, text) {
  const v = cache.get(keyOf(url, text));
  return v && !(v instanceof Promise) ? v : undefined;
}
