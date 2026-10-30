// Structural URL red flags. Each is weak alone; the scorer combines them.

import { signal } from './signal.js';
import { tldOf, subdomainLabels, isLoopbackHost } from '../core/url.js';
import { ODD_TLDS, CREDENTIAL_WORDS } from '../config/lists.js';

export const id = 'url-structure';

const LONG_URL = 200;
const MANY_SUBDOMAINS = 4;

// The "user:pass@host:port" part of the URL as the user typed it.
function authorityOf(raw) {
  const start = raw.indexOf('//');
  if (start === -1) return '';
  const rest = raw.slice(start + 2);
  const end = rest.search(/[/?#\\]/);
  return end === -1 ? rest : rest.slice(0, end);
}

export function check({ url }) {
  const out = [];
  if (url.isIp && !isLoopbackHost(url.host)) {
    out.push(signal('url.ip_host', 'structure', url.host, 'Link points to a raw IP address instead of a domain name'));
  }
  // "@" before the host means everything before it is ignored by the browser.
  const authority = authorityOf(url.raw);
  if (url.username || url.password || authority.includes('@')) {
    const shown = authority.slice(0, authority.lastIndexOf('@') + 1) || '@';
    out.push(signal('url.at_sign', 'structure', shown, `Text before "@" is ignored; the real destination is ${url.host}`));
  }
  if (!url.isIp) {
    const subs = subdomainLabels(url.host, url.registrable);
    if (subs.length >= MANY_SUBDOMAINS) {
      out.push(signal('url.many_subdomains', 'structure', url.host, `${subs.length} levels of subdomains`));
    }
    const tld = tldOf(url.host);
    if (ODD_TLDS.has(tld)) {
      out.push(signal('url.odd_tld', 'structure', `.${tld}`, `".${tld}" is a top-level domain frequently used for abuse`));
    }
  }
  if (url.href.length > LONG_URL) {
    out.push(signal('url.long', 'structure', `${url.href.slice(0, 60)}…`, `Very long URL (${url.href.length} characters)`));
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    out.push(signal('url.nonstandard_port', 'structure', `:${url.port}`, `Uses unusual port ${url.port}`));
  }
  if (url.scheme === 'http') {
    out.push(signal('url.insecure_http', 'structure', 'http://', 'Connection is not encrypted (http)'));
  }
  const haystack = `${url.host}${url.path}`.toLowerCase();
  const word = CREDENTIAL_WORDS.find((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(haystack));
  if (word) {
    out.push(signal('url.credential_words', 'structure', word, `Contains the word "${word}", common in credential-phishing links`));
  }
  return out;
}
