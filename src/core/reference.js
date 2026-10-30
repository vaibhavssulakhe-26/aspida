// Builds the read-only reference context that checks receive as `ctx`.
// Pure: takes plain text/arrays, returns plain objects. The background
// worker loads the bundled files and calls this; tests call it directly.

import { registrableDomain, domainLabel, normalizeHost } from './url.js';
import { BRANDS } from '../config/brands.js';

export function parseDomainList(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    // Accept "domain" and Tranco-style "rank,domain".
    const d = normalizeHost(t.includes(',') ? t.split(',')[1] : t);
    if (d) out.push(d);
  }
  return out;
}

export function buildReference({ topDomains = [], allowlist = [], brands = BRANDS } = {}) {
  const top = new Set();
  const labelsByLength = new Map(); // len -> Set(label)
  const labelOwners = new Map(); // label -> first registrable domain seen (highest rank)
  const labelRank = new Map(); // label -> 1-based rank of its best domain; brands are 0
  topDomains.forEach((d, i) => {
    const reg = registrableDomain(d);
    top.add(reg);
    const label = domainLabel(reg);
    if (label.length < 4) return; // too short to compare meaningfully
    if (!labelOwners.has(label)) {
      labelOwners.set(label, reg);
      labelRank.set(label, i + 1);
    }
    if (!labelsByLength.has(label.length)) labelsByLength.set(label.length, new Set());
    labelsByLength.get(label.length).add(label);
  });
  // Brand official domains are always part of the reference set and are
  // always eligible for fuzzy matching (rank 0).
  const brandDomains = new Set();
  for (const b of brands) {
    for (const d of b.domains) {
      brandDomains.add(d);
      const label = domainLabel(d);
      if (label.length < 4) continue;
      if (!labelOwners.has(label)) labelOwners.set(label, d);
      labelRank.set(label, 0);
      if (!labelsByLength.has(label.length)) labelsByLength.set(label.length, new Set());
      labelsByLength.get(label.length).add(label);
    }
  }
  const allow = new Set(allowlist.map((a) => normalizeHost(a)).filter(Boolean));
  return { top, brandDomains, labelsByLength, labelOwners, labelRank, brands, allowlist: allow };
}

// True when the host is covered by the user allowlist (exact host or any
// parent domain on the list).
export function isAllowlisted(ctx, host) {
  if (!ctx?.allowlist?.size) return false;
  let cur = normalizeHost(host);
  while (cur) {
    if (ctx.allowlist.has(cur)) return true;
    const i = cur.indexOf('.');
    if (i === -1) break;
    cur = cur.slice(i + 1);
  }
  return false;
}

// True when the registrable domain is a well-known site (top list or an
// official brand domain). Heuristic checks must not flag these.
export function isWellKnown(ctx, registrable) {
  return !!ctx && (ctx.top.has(registrable) || ctx.brandDomains.has(registrable));
}
