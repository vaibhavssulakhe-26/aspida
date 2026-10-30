// Pure analysis pipeline: input + reference context (+ feed hits looked up
// by the caller) -> verdict. No chrome.*, no network, no storage.
//
// Verdict shape (shared by every UI surface):
//   { subject, kind: 'url'|'sender', host, hostUnicode, registrable,
//     tier, label, score, reasons: Signal[], allowlisted }

import { parseUrl, registrableDomain, unwrapRedirect } from './url.js';
import { isAllowlisted, isWellKnown } from './reference.js';
import { URL_CHECKS, SENDER_CHECKS } from '../checks/index.js';
import * as feedMatch from '../checks/feed-match.js';
import { domainOfAddress } from '../checks/sender-checks.js';
import { score, worstTier } from '../scoring/score.js';
import en from '../config/strings/en.js';

// On well-known domains only these signals survive (exact-URL feed hits are
// precise enough to trust even on big sites; shortener is informational).
const KEEP_ON_WELL_KNOWN = new Set(['feed.url_match', 'shortener.known']);

function runChecks(checks, input, ctx) {
  const out = [];
  for (const c of checks) {
    if (ctx?.disabledChecks?.has(c.id)) continue;
    try {
      out.push(...c.check(input, ctx));
    } catch {
      // A buggy check must never take the others down with it.
    }
  }
  return out;
}

function allowlistedVerdict(base) {
  return { ...base, tier: 'none', label: en['tier.none'], score: 0, reasons: [], allowlisted: true };
}

// extra.linkText: visible text of the anchor, when known (enables link-text check).
// Known click-tracking wrappers (l.instagram.com/?u=...) are unwrapped
// locally first; the verdict is about the real destination.
export function analyzeUrl(raw, ctx, feedHits = [], extra = {}) {
  const wrapped = unwrapRedirect(raw);
  if (wrapped) {
    const inner = analyzeUrl(wrapped.url, ctx, feedHits, extra);
    return inner && { ...inner, via: wrapped.via };
  }
  const url = parseUrl(raw);
  if (!url) return null;
  const base = { subject: url.href, kind: 'url', host: url.host, hostUnicode: url.hostUnicode, registrable: url.registrable };
  if (isAllowlisted(ctx, url.host)) return allowlistedVerdict(base);
  let signals = runChecks(URL_CHECKS, { url, feedHits, linkText: extra.linkText }, ctx);
  if (isWellKnown(ctx, url.registrable)) signals = signals.filter((s) => KEEP_ON_WELL_KNOWN.has(s.id));
  return { ...base, ...score(signals), allowlisted: false };
}

export function analyzeSender(sender, ctx, feedHits = []) {
  const domain = domainOfAddress(sender?.address);
  if (!domain) return null;
  const reg = registrableDomain(domain);
  const base = { subject: sender.address, kind: 'sender', host: domain, hostUnicode: domain, registrable: reg };
  if (isAllowlisted(ctx, domain)) return allowlistedVerdict(base);
  const signals = runChecks(SENDER_CHECKS, sender, ctx);
  // Host-level feed hits on the sender domain (URL hits make no sense here).
  const hostHits = feedHits.filter((h) => h.kind === 'host');
  if (!isWellKnown(ctx, reg)) signals.push(...feedMatch.check({ url: { href: domain }, feedHits: hostHits }));
  return { ...base, ...score(signals), allowlisted: false };
}

// Summary over several verdicts (an email = sender + links).
export function combine(verdicts) {
  const list = verdicts.filter(Boolean);
  const tier = worstTier(list.map((v) => v.tier));
  return { tier, label: en[`tier.${tier}`], count: list.length };
}
