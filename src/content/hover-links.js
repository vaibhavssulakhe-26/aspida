// Hover verdict for every link on http(s) pages.
//  - IntersectionObserver pre-checks links as they scroll into view, so the
//    verdict is usually cached before the pointer arrives.
//  - Tooltip on hover (and keyboard focus) renders tier + cited evidence.
//    This is the only way a verdict appears next to a link: nothing is ever
//    drawn beside links persistently (chat badges are a separate opt-in).
//  - Risky tooltips can carry "Report this link" (setting reportButton). Only
//    that button takes the pointer (the tooltip never covers links below it);
//    the tooltip waits briefly when the pointer leaves the link so the button
//    can be reached, and the report step stays until Close, Escape or a click
//    elsewhere.
//    Reporting only copies the URL or asks the worker to open a reporting
//    site in a new tab; nothing is sent automatically.
// Read-only: never clicks, follows, prefetches or modifies links.

import { verdictFor, cachedVerdict } from './link-scanner.js';
import { FloatingPanel } from '../ui/overlay.js';
import { renderVerdict, renderReportPanel } from '../ui/render.js';
import { copyText } from '../ui/clipboard.js';
import { canReport } from '../core/report.js';
import { send } from '../platform/messaging.js';
import { safe, debounce, debug, anchorText, httpHref } from './util.js';

const SHOW_DELAY_CLEAN_MS = 450; // clean links: don't flash a tooltip on every pass
const SHOW_DELAY_RISKY_MS = 120;
const LEAVE_GRACE_MS = 250; // time to move the pointer from a link onto its interactive tooltip
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
  clearTimeout(state.hideTimer); // a pending hide from the previous link must not hide this one
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
      const report = state.reportButton && canReport(verdict) ? { onOpen: safe(() => openReport(a, verdict), 'report') } : null;
      state.panel.show(a.getBoundingClientRect(), renderVerdict(verdict, { mode: 'tooltip', report }));
      wirePanel(state.panel.box);
      state.interactive = !!report;
      state.current = a;
    }, 'tooltip show'),
    delay,
  );
}

// Swap the tooltip for the report step (same panel, same place).
function openReport(a, verdict) {
  if (!state) return;
  state.reporting = true;
  clearTimeout(state.hideTimer);
  const rect = a.isConnected ? a.getBoundingClientRect() : state.panel.box.getBoundingClientRect();
  const shadow = state.panel.box.getRootNode(); // the copy fallback needs a node inside our shadow root
  const panel = renderReportPanel(verdict, {
    copy: (text) => copyText(text, shadow),
    open: (dest, url) => send('open-report', { dest, target: url, tier: verdict.tier, signals: (verdict.reasons || []).map((r) => r.id) }).then((ok) => !!ok, () => false),
    close: () => hide(),
  });
  state.panel.show(rect, panel, { interactive: true });
  wirePanel(state.panel.box);
  panel.querySelector('input, button')?.focus({ preventScroll: true });
}

function hide() {
  if (!state) return;
  state.token = null;
  state.reporting = false;
  state.interactive = false;
  clearTimeout(state.showTimer);
  clearTimeout(state.hideTimer);
  state.panel.hide();
  state.current = null;
}

// Leaving a link: plain tooltips go at once; interactive ones after a short
// grace so the pointer can reach them.
function leaveLink() {
  if (!state || state.reporting) return;
  if (!state.interactive) return hide();
  clearTimeout(state.hideTimer);
  state.hideTimer = setTimeout(safe(hide, 'tooltip hide'), LEAVE_GRACE_MS);
}

// Pointer and keys inside the interactive panel. Events are stopped at the
// panel so the page doesn't react to clicks on Aspida's buttons.
function wirePanel(box) {
  if (!box || state.wired.has(box)) return;
  state.wired.add(box);
  box.addEventListener('mouseenter', () => state && clearTimeout(state.hideTimer));
  box.addEventListener('mouseleave', () => state && !state.reporting && state.interactive && leaveLink());
  for (const type of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup']) {
    box.addEventListener(type, (e) => {
      if (type === 'keydown' && e.key === 'Escape') hide();
      e.stopPropagation();
    });
  }
}

export function start(settings) {
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
  state = {
    io, seen: new WeakSet(), observed: 0, panel: new FloatingPanel(), token: null, showTimer: null, hideTimer: null, current: null, listeners: [],
    reportButton: settings?.reportButton !== false, interactive: false, reporting: false, wired: new WeakSet(),
  };

  const on = (target, type, fn, opts) => {
    const h = safe(fn, type);
    target.addEventListener(type, h, opts);
    state.listeners.push([target, type, h, opts]);
  };
  on(document, 'mouseover', (e) => {
    if (state.reporting) return; // the report step stays until closed
    const a = anchorFrom(e.target);
    if (a && a === state.current) clearTimeout(state.hideTimer);
    if (a && a !== state.current) showFor(a);
  }, { capture: true, passive: true });
  on(document, 'mouseout', (e) => {
    const a = anchorFrom(e.target);
    if (!a || (e.relatedTarget instanceof Node && a.contains(e.relatedTarget))) return;
    if (state.panel.owns(e.relatedTarget) && state.interactive) return clearTimeout(state.hideTimer);
    leaveLink();
  }, { capture: true, passive: true });
  on(document, 'focusin', (e) => {
    if (state.reporting || state.panel.owns(e.target)) return;
    const a = anchorFrom(e.target);
    if (a) showFor(a);
  }, { capture: true });
  on(document, 'focusout', (e) => {
    if (state.reporting || state.panel.owns(e.relatedTarget)) return;
    hide();
  }, { capture: true });
  on(document, 'mousedown', (e) => state.reporting && !state.panel.owns(e.target) && hide(), { capture: true, passive: true });
  on(document, 'keydown', (e) => e.key === 'Escape' && hide(), { capture: true });
  on(window, 'scroll', () => !state.reporting && hide(), { capture: true, passive: true });

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

// Settings changed while running (reportButton applies to the next tooltip).
export function update(settings) {
  if (state) state.reportButton = settings?.reportButton !== false;
}

export function stop() {
  if (!state) return;
  for (const [t, type, h, opts] of state.listeners) t.removeEventListener(type, h, opts);
  state.io.disconnect();
  state.mo?.disconnect();
  clearTimeout(state.showTimer);
  clearTimeout(state.hideTimer);
  state.panel.destroy();
  state = null;
  debug('hover-links stopped');
}
