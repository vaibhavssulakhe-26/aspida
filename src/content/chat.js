// Chat link scanner, parameterised by a site selectors file. Watches the
// message list and pre-checks every link in messages, so the hover tooltip
// (hover-links.js) is instant. Only with the "Show inline badges in chat"
// setting (off by default) does it also put a small Shadow-DOM badge after
// risky links. Read-only: never clicks, replies, sends, or edits messages.
// Selector misses are logged (debug) and otherwise ignored.

import { verdictFor } from './link-scanner.js';
import { inlineShadow } from '../ui/overlay.js';
import { renderBadge } from '../ui/render.js';
import { t } from '../config/strings/index.js';
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

  function unbadge(a) {
    state.badged.get(a)?.remove();
    state.badged.delete(a);
  }

  async function check(a, href) {
    const verdict = await verdictFor(href, anchorText(a));
    // Chat apps recycle message elements: only badge if the anchor still
    // points where it did when we checked it.
    if (!state || !state.badges || !verdict || verdict.tier === 'none' || !a.isConnected || httpHref(a) !== href) return;
    if (state.badged.has(a)) return;
    const { host, root } = inlineShadow(a);
    host.title = t('badge.title', { label: t(`tier.${verdict.tier}`), detail: verdict.reasons[0]?.detail || '' });
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
    // Drop badges whose link was removed or now points somewhere else.
    for (const a of [...state.badged.keys()]) {
      if (!a.isConnected || state.seen.get(a) !== httpHref(a)) unbadge(a);
    }
    for (const a of allMatches(site.links)) {
      const href = httpHref(a);
      if (!href || state.seen.get(a) === href) continue;
      state.seen.set(a, href);
      unbadge(a);
      check(a, href).catch((e) => debug(`${site.id}: check failed`, e));
    }
  }

  function removeBadges() {
    for (const host of state.badged.values()) host.remove();
    state.badged.clear();
  }

  return {
    id: site.id,
    start(settings) {
      if (state) return;
      state = { seen: new WeakMap(), badged: new Map(), badges: !!settings?.chatInlineBadges, startedAt: Date.now(), reportedMiss: false };
      const run = debounce(safe(scan, `${site.id} scan`), SCAN_DEBOUNCE_MS);
      state.run = run;
      // attributes/href: recycled message elements get a new href in place.
      state.mo = new MutationObserver(run);
      state.mo.observe(document.documentElement, { childList: true, subtree: true, characterData: false, attributes: true, attributeFilter: ['href'] });
      run();
      debug(`${site.id}: chat scanner started`);
    },
    // Live settings change while running (inline badges on/off).
    update(settings) {
      if (!state) return;
      const want = !!settings.chatInlineBadges;
      if (want === state.badges) return;
      state.badges = want;
      if (!want) removeBadges();
      else {
        state.seen = new WeakMap(); // re-check everything (verdicts are cached)
        state.run();
      }
    },
    stop() {
      if (!state) return;
      state.mo.disconnect();
      removeBadges();
      state = null;
    },
  };
}
