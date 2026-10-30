// Hover verdict for every link on http(s) pages.
//  - IntersectionObserver pre-checks links as they scroll into view, so the
//    verdict is usually cached before the pointer arrives.
//  - Tooltip on hover (and keyboard focus) renders tier + cited evidence.
//    This is the only way a verdict appears next to a link: nothing is ever
//    drawn beside links persistently (chat badges are a separate opt-in).
// Read-only: never clicks, follows, prefetches or modifies links.

import { verdictFor, cachedVerdict } from './link-scanner.js';
import { FloatingPanel } from '../ui/overlay.js';
import { renderVerdict } from '../ui/render.js';
import { safe, debounce, debug, anchorText, httpHref } from './util.js';

const SHOW_DELAY_CLEAN_MS = 450; // clean links: don't flash a tooltip on every pass
const SHOW_DELAY_RISKY_MS = 120;
const MAX_OBSERVED = 3000;

let state = null;

function anchorFrom(target) {
  return target instanceof Element ? target.closest('a[href]') : null;
}

function precheck(a) {
  const href = httpHref(a);
  if (href) verdictFor(href, anchorText(a));
}

function observeLinks(root) {
  if (!state) return;
  const list = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
  for (const a of list) {
    if (state.observed >= MAX_OBSERVED) return;
    if (state.seen.has(a)) continue;
    state.seen.add(a);
    state.observed++;
    state.io.observe(a);
  }
}

async function showFor(a) {
  const href = httpHref(a);
  if (!href || !state) return;
  const text = anchorText(a);
  const token = (state.token = {});
  let verdict = cachedVerdict(href, text);
  if (!verdict) verdict = await verdictFor(href, text);
  if (!verdict || !state || state.token !== token) return;
  const delay = verdict.tier === 'none' ? SHOW_DELAY_CLEAN_MS : SHOW_DELAY_RISKY_MS;
  clearTimeout(state.showTimer);
  state.showTimer = setTimeout(
    safe(() => {
      if (!state || state.token !== token || !a.isConnected) return;
      state.panel.show(a.getBoundingClientRect(), renderVerdict(verdict, { mode: 'tooltip' }));
      state.current = a;
    }, 'tooltip show'),
    delay,
  );
}

function hide() {
  if (!state) return;
  state.token = null;
  clearTimeout(state.showTimer);
  state.panel.hide();
  state.current = null;
}

export function start() {
  if (state) return;
  const io = new IntersectionObserver(
    safe((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        precheck(e.target);
      }
    }, 'intersection'),
    { rootMargin: '200px' },
  );
  state = { io, seen: new WeakSet(), observed: 0, panel: new FloatingPanel(), token: null, showTimer: null, current: null, listeners: [] };

  const on = (target, type, fn, opts) => {
    const h = safe(fn, type);
    target.addEventListener(type, h, opts);
    state.listeners.push([target, type, h, opts]);
  };
  on(document, 'mouseover', (e) => {
    const a = anchorFrom(e.target);
    if (a && a !== state.current) showFor(a);
  }, { capture: true, passive: true });
  on(document, 'mouseout', (e) => {
    const a = anchorFrom(e.target);
    if (a && !(e.relatedTarget instanceof Node && a.contains(e.relatedTarget))) hide();
  }, { capture: true, passive: true });
  on(document, 'focusin', (e) => {
    const a = anchorFrom(e.target);
    if (a) showFor(a);
  }, { capture: true });
  on(document, 'focusout', hide, { capture: true });
  on(document, 'keydown', (e) => e.key === 'Escape' && hide(), { capture: true });
  on(window, 'scroll', hide, { capture: true, passive: true });

  observeLinks(document);
  const rescan = debounce(safe(() => observeLinks(document), 'rescan'), 600);
  state.mo = new MutationObserver(() => {
    if (!state) return;
    // The hovered link was removed (SPA re-render): no mouseout will come, so
    // don't leave its tooltip floating on the page.
    if (state.current && !state.current.isConnected) hide();
    if (state.observed < MAX_OBSERVED) rescan();
  });
  state.mo.observe(document.documentElement, { childList: true, subtree: true });
  debug('hover-links started');
}

export function stop() {
  if (!state) return;
  for (const [t, type, h, opts] of state.listeners) t.removeEventListener(type, h, opts);
  state.io.disconnect();
  state.mo?.disconnect();
  clearTimeout(state.showTimer);
  state.panel.destroy();
  state = null;
  debug('hover-links stopped');
}
