// Chat link scanner, parameterised by a site selectors file. Watches the
// message list, checks every link in messages, and puts a small Shadow-DOM
// badge after links that show risk signals. Read-only: never clicks,
// replies, sends, or edits messages. Selector misses are logged (debug) and
// otherwise ignored.

import { verdictFor } from './link-scanner.js';
import { inlineShadow } from '../ui/overlay.js';
import { renderBadge } from '../ui/render.js';
import { safe, debounce, debug, anchorText, httpHref } from './util.js';

const SCAN_DEBOUNCE_MS = 350;
const SELECTOR_MISS_REPORT_MS = 15000;

export function matchesSite(site, loc = location) {
  return site.hosts.includes(loc.hostname) && (!site.pathPrefix || loc.pathname.startsWith(site.pathPrefix));
}

function firstMatch(selectors, root = document) {
  for (const s of selectors) {
    try {
      const el = root.querySelector(s);
      if (el) return el;
    } catch {
      // invalid selector in config: skip it
    }
  }
  return null;
}

function allMatches(selectors, root = document) {
  const out = new Set();
  for (const s of selectors) {
    try {
      root.querySelectorAll(s).forEach((a) => out.add(a));
    } catch {
      // skip
    }
  }
  return out;
}

export function createChatScanner(site) {
  let state = null;

  async function check(a) {
    const href = httpHref(a);
    if (!href) return;
    const verdict = await verdictFor(href, anchorText(a));
    if (!state || !verdict || verdict.tier === 'none' || !a.isConnected) return;
    if (state.badged.has(a)) return;
    const { host, root } = inlineShadow(a);
    host.title = `Aspida: ${verdict.label}. ${verdict.reasons[0]?.detail || ''}`;
    root.append(renderBadge(verdict));
    state.badged.set(a, host);
  }

  function scan() {
    if (!state) return;
    if (!firstMatch(site.container)) {
      if (!state.reportedMiss && Date.now() - state.startedAt > SELECTOR_MISS_REPORT_MS) {
        state.reportedMiss = true;
        debug(`${site.id}: no message container matched; selectors may be outdated`, site.container);
      }
      return;
    }
    for (const a of allMatches(site.links)) {
      if (state.seen.has(a)) continue;
      state.seen.add(a);
      check(a).catch((e) => debug(`${site.id}: check failed`, e));
    }
  }

  return {
    id: site.id,
    start() {
      if (state) return;
      state = { seen: new WeakSet(), badged: new Map(), startedAt: Date.now(), reportedMiss: false };
      const run = debounce(safe(scan, `${site.id} scan`), SCAN_DEBOUNCE_MS);
      state.mo = new MutationObserver(run);
      state.mo.observe(document.documentElement, { childList: true, subtree: true, characterData: false });
      run();
      debug(`${site.id}: chat scanner started`);
    },
    stop() {
      if (!state) return;
      state.mo.disconnect();
      for (const host of state.badged.values()) host.remove();
      state = null;
    },
  };
}
