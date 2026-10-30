// Classify decoded QR text. Pure. The text is data: it is shown to the user
// and analysed, never opened.
//
// Result:
//   { type: 'url', url, display }    url: what is analysed (a scheme is added
//                                    to bare domains); display: the original text
//   { type: 'upi', payee, name, amount, currency, text }
//   { type: 'text', text, maybeUrl?, host? }
//                                    maybeUrl/host: not a clear web address, but
//                                    a scanner app might still open it as one

import { TLDS, FILE_LIKE_TLDS } from '../config/tlds.js';

// host[:port][/path][?query][#fragment], no spaces, no user@ part.
const HOSTISH = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}\p{N}-]{2,63}\.?(?::\d{1,5})?(?:[/?#]\S*)?$/u;

// Bare "host[...]" text whose last label is a real TLD -> { url, host, tld, bare }.
// bare: nothing but "name.tld" (no subdomain, port, path or query).
function parseHostish(s) {
  if (!HOSTISH.test(s)) return null;
  let u;
  try {
    u = new URL(`https://${s}`);
  } catch {
    return null;
  }
  const labels = u.hostname.replace(/\.$/, '').split('.');
  const tld = labels[labels.length - 1];
  if (!TLDS.has(tld)) return null;
  return { url: `https://${s}`, host: u.hostname, tld, bare: labels.length === 2 && !/[:/?#]/.test(s) };
}

// First domain-like word inside free text ("Refunds at paypa1.test/claim").
// Email addresses are skipped: scanners offer to write a mail, not open a site.
function domainInText(t) {
  for (const raw of t.split(/\s+/)) {
    if (raw.includes('@')) continue;
    const word = raw.replace(/^[("'<[]+|[)"'>\],.;:!?]+$/g, '');
    const h = word && parseHostish(word);
    if (h) return h;
  }
  return null;
}

export function classifyQrText(text) {
  const t = String(text || '').trim();
  if (/^https?:\/\//i.test(t)) return { type: 'url', url: t, display: t };
  if (/^upi:\/\/pay\?/i.test(t)) {
    let params;
    try {
      params = new URL(t).searchParams;
    } catch {
      return { type: 'text', text: t };
    }
    return {
      type: 'upi',
      payee: params.get('pa') || '',
      name: params.get('pn') || '',
      amount: params.get('am') || '',
      currency: params.get('cu') || 'INR',
      text: t,
    };
  }
  // Scheme-relative "//host/path".
  if (t.startsWith('//')) {
    const h = parseHostish(t.slice(2));
    return h ? { type: 'url', url: `https:${t}`, display: t } : { type: 'text', text: t };
  }
  // Bare domains ("gooogle.com", "www.example.com/a", "paypa1.test/login"):
  // scanner apps open these as websites. File names aren't matched because
  // ".txt", ".pdf", ".exe" etc. are not TLDs; "setup.zip"-style names whose
  // suffix is also a TLD are only "may open as a link".
  const h = parseHostish(t);
  if (h && !(h.bare && FILE_LIKE_TLDS.has(h.tld))) return { type: 'url', url: h.url, display: t };
  const inner = h || domainInText(t);
  return inner ? { type: 'text', text: t, maybeUrl: inner.url, host: inner.host } : { type: 'text', text: t };
}
