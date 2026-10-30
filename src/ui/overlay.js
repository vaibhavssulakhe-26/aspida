// Shadow-DOM overlay used by content scripts. One fixed, zero-size host per
// page; page CSS cannot reach inside and our CSS cannot leak out.

import { VERDICT_CSS } from './render.js';

const HOST_ATTR = 'data-aspida-overlay';

const OVERLAY_CSS = `
:host { all: initial; }
.tl-float { position: fixed; z-index: 2147483647; pointer-events: none; max-width: min(360px, calc(100vw - 16px));
  opacity: 0; transform: translateY(4px); transition: opacity 90ms ease-in, transform 90ms ease-in; }
.tl-float[data-open] { opacity: 1; transform: none; transition-duration: 140ms; transition-timing-function: ease-out; }
.tl-float[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) {
  .tl-float, .tl-float[data-open] { transform: none; transition: opacity 50ms linear; }
}
`;

let shared = null;

function createHost(doc) {
  const host = doc.createElement('div');
  host.setAttribute(HOST_ATTR, '');
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
  const root = host.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = VERDICT_CSS + OVERLAY_CSS;
  root.append(style);
  return { host, root };
}

// Returns { root } and makes sure the host is still attached (SPAs sometimes
// wipe foreign nodes).
export function overlayRoot(doc = document) {
  if (!shared) shared = createHost(doc);
  if (!shared.host.isConnected) doc.documentElement.append(shared.host);
  return shared.root;
}

export function removeOverlay() {
  shared?.host.remove();
  shared = null;
}

// Fade-and-lift durations; keep in sync with OVERLAY_CSS. The settle timer
// runs once per show/hide (no animation loop) to drop will-change and to set
// [hidden] after the fade-out.
const FADE_IN_MS = 140;
const FADE_OUT_MS = 90;

// A floating panel placed next to a target rect, flipped/clamped to stay on
// screen. Used by the link tooltip and the QR tooltip. The element is reused,
// so moving from link to link retargets the running transition instead of
// restarting it (no flicker). Only opacity and transform are animated, and
// the position is set before the panel becomes visible (no jump).
export class FloatingPanel {
  constructor(doc = document) {
    this.doc = doc;
    this.box = null;
    this.settleTimer = null;
  }

  settle(ms, after) {
    clearTimeout(this.settleTimer);
    this.box.style.willChange = 'opacity, transform';
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (!this.box) return;
      this.box.style.willChange = '';
      after?.();
    }, ms + 20);
  }

  show(rect, content) {
    const root = overlayRoot(this.doc);
    if (!this.box || !this.box.isConnected) {
      this.box = this.doc.createElement('div');
      this.box.className = 'tl-float';
      root.append(this.box);
    }
    this.box.replaceChildren(content);
    this.box.hidden = false;
    this.box.style.left = '0px';
    this.box.style.top = '0px';
    const w = this.box.offsetWidth;
    const h = this.box.offsetHeight;
    const vw = this.doc.documentElement.clientWidth;
    const vh = this.doc.documentElement.clientHeight;
    const gap = 8;
    let top = rect.bottom + gap;
    if (top + h > vh - gap && rect.top - gap - h >= gap) top = rect.top - gap - h;
    let left = Math.min(Math.max(gap, rect.left), Math.max(gap, vw - w - gap));
    top = Math.min(Math.max(gap, top), Math.max(gap, vh - h - gap));
    this.box.style.left = `${Math.round(left)}px`;
    this.box.style.top = `${Math.round(top)}px`;
    if (!this.box.hasAttribute('data-open')) {
      // offsetWidth above flushed the closed style, so this starts the fade-in.
      this.box.setAttribute('data-open', '');
      this.settle(FADE_IN_MS);
    }
  }

  hide() {
    const box = this.box;
    if (!box || box.hidden || !box.hasAttribute('data-open')) return;
    box.removeAttribute('data-open');
    this.settle(FADE_OUT_MS, () => {
      if (!box.hasAttribute('data-open')) box.hidden = true;
    });
  }

  destroy() {
    clearTimeout(this.settleTimer);
    this.box?.remove();
    this.box = null;
  }
}

// Block-level closed shadow root inserted before an element (Gmail banner).
export function blockShadowBefore(beforeEl, doc = document) {
  const host = doc.createElement('div');
  host.setAttribute('data-aspida-banner', '');
  host.style.cssText = 'all: initial; display: block; margin: 0 0 8px;';
  const root = host.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = VERDICT_CSS;
  root.append(style);
  beforeEl.before(host);
  return { host, root };
}

// Attach a small closed shadow root next to an element (chat badges).
// Returns the shadow root to render into.
export function inlineShadow(afterEl, doc = document) {
  const host = doc.createElement('span');
  host.setAttribute('data-aspida-badge', '');
  host.style.cssText = 'all: initial; display: inline; ';
  const root = host.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = VERDICT_CSS;
  root.append(style);
  afterEl.after(host);
  return { host, root };
}
