// Pure URL helpers. No chrome.* and no network. Safe to import anywhere,
// including Node unit tests.

import { MULTI_PART_SUFFIXES, HOSTING_SUFFIXES } from '../config/lists.js';

// Parse an href into the parts the checks need. Returns null for anything
// that is not http(s), so callers can skip mailto:, javascript:, etc.
export function parseUrl(raw, base) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;
  let u;
  try {
    u = base ? new URL(text, base) : new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = normalizeHost(u.hostname);
  if (!host) return null;
  return {
    href: u.href,
    raw: text,
    scheme: u.protocol.slice(0, -1),
    host,
    hostUnicode: toUnicodeHost(host),
    port: u.port,
    path: u.pathname,
    query: u.search,
    username: u.username,
    password: u.password,
    registrable: registrableDomain(host),
    isIp: isIpHost(host),
  };
}

// Click-tracking wrappers whose real destination is a query parameter.
// Reading the parameter is local string parsing: nothing is fetched.
const REDIRECT_WRAPPERS = [
  { host: 'l.instagram.com', path: '/', param: 'u' },
  { host: 'l.facebook.com', path: '/l.php', param: 'u' },
  { host: 'lm.facebook.com', path: '/l.php', param: 'u' },
  { host: 'l.messenger.com', path: '/l.php', param: 'u' },
  { host: 'www.google.com', path: '/url', param: 'q' },
  { host: 'www.google.com', path: '/url', param: 'url' },
  { host: 'google.com', path: '/url', param: 'q' },
  { host: 'out.reddit.com', path: '/', param: 'url', prefix: true },
  { host: 'www.youtube.com', path: '/redirect', param: 'q' },
  { host: 'slack-redir.net', path: '/link', param: 'url' },
];

// Returns { url: innerUrl, via: wrapperHost } or null.
export function unwrapRedirect(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = normalizeHost(u.hostname);
  for (const w of REDIRECT_WRAPPERS) {
    if (w.host !== host) continue;
    if (w.prefix ? !u.pathname.startsWith(w.path) : u.pathname !== w.path) continue;
    const inner = u.searchParams.get(w.param);
    if (inner && /^https?:\/\//i.test(inner)) return { url: inner, via: host };
  }
  return null;
}

// Lowercase, strip a trailing dot and IPv6 brackets.
export function normalizeHost(host) {
  if (!host) return '';
  let h = String(host).toLowerCase().trim();
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  return h;
}

export function isIpHost(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(':')) return true; // IPv6 (URL parser already validated it)
  // Integer / hex forms are normalised by the URL parser into dotted quads.
  return false;
}

// Registrable domain ("eTLD+1") using a compact suffix list. Hosting
// platforms are treated as suffixes so each tenant is its own domain.
// Second-level labels that ccTLDs commonly use as public suffixes
// ("google.com.om", "bbc.co.ke"). Applied to any two-letter TLD.
const CC_SECOND_LEVELS = new Set(['com', 'co', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'gob', 'mil', 'nic']);

export function registrableDomain(host) {
  const h = normalizeHost(host);
  if (!h || isIpHost(h)) return h;
  const labels = h.split('.');
  if (labels.length <= 2) return h;
  for (let i = 1; i < labels.length - 1; i++) {
    const suffix = labels.slice(i).join('.');
    if (HOSTING_SUFFIXES.has(suffix) || MULTI_PART_SUFFIXES.has(suffix)) {
      return labels.slice(i - 1).join('.');
    }
  }
  const n = labels.length;
  if (labels[n - 1].length === 2 && CC_SECOND_LEVELS.has(labels[n - 2])) return labels.slice(-3).join('.');
  return labels.slice(-2).join('.');
}

// The suffix part of a registrable domain ("co.in", "com", "vercel.app").
export function publicSuffixOf(registrable) {
  const i = registrable.indexOf('.');
  return i === -1 ? '' : registrable.slice(i + 1);
}

// "paypa1.co.in" -> "paypa1". The part a human reads as the brand.
export function domainLabel(registrable) {
  const i = registrable.indexOf('.');
  return i === -1 ? registrable : registrable.slice(0, i);
}

export function tldOf(host) {
  const i = host.lastIndexOf('.');
  return i === -1 ? host : host.slice(i + 1);
}

// Subdomain labels in front of the registrable domain.
export function subdomainLabels(host, registrable) {
  if (host === registrable) return [];
  const prefix = host.slice(0, host.length - registrable.length - 1);
  return prefix ? prefix.split('.') : [];
}

// Key used for full-URL feed matching: scheme-less, lowercase host, default
// ports dropped, fragment dropped, trailing slash dropped.
export function feedUrlKey(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = normalizeHost(u.hostname);
  if (!host) return null;
  let path = u.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path === '/') path = '';
  const port = u.port ? `:${u.port}` : '';
  return `${host}${port}${path}${u.search}`;
}

// Hosts to look up in host-level feeds: the host itself and each parent
// down to (and including) the registrable domain.
export function hostLookupChain(host) {
  const h = normalizeHost(host);
  const reg = registrableDomain(h);
  const out = [h];
  let cur = h;
  while (cur !== reg && cur.includes('.')) {
    cur = cur.slice(cur.indexOf('.') + 1);
    out.push(cur);
    if (cur === reg) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Punycode (RFC 3492) decoder, only what we need to show IDN hosts and run
// script checks. Encoding is never needed: the URL parser does that.
const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;

function adapt(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  for (; delta > ((BASE - TMIN) * TMAX) >> 1; k += BASE) {
    delta = Math.floor(delta / (BASE - TMIN));
  }
  return Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

function basicToDigit(cp) {
  if (cp >= 0x30 && cp < 0x3a) return cp - 22;
  if (cp >= 0x41 && cp < 0x5b) return cp - 65;
  if (cp >= 0x61 && cp < 0x7b) return cp - 97;
  return BASE;
}

export function punycodeDecode(input) {
  const output = [];
  let basic = input.lastIndexOf('-');
  if (basic < 0) basic = 0;
  for (let j = 0; j < basic; j++) output.push(input.charCodeAt(j));
  let n = INITIAL_N, bias = INITIAL_BIAS, i = 0;
  for (let index = basic > 0 ? basic + 1 : 0; index < input.length;) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (index >= input.length) throw new Error('punycode: bad input');
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= BASE) throw new Error('punycode: bad digit');
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

export function toUnicodeHost(host) {
  return host
    .split('.')
    .map((label) => {
      if (!label.startsWith('xn--')) return label;
      try {
        return punycodeDecode(label.slice(4));
      } catch {
        return label;
      }
    })
    .join('.');
}
