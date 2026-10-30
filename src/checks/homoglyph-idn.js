// IDN / homoglyph checks on punycode hosts:
//  - any punycode label (informational)
//  - a single label mixing Latin with Cyrillic/Greek/Armenian
//  - the host, rendered, imitates a well-known domain ("аррӏе.com")
//
// Also exported: findHomoglyphTarget(host, ctx), reused by sender checks.

import { signal } from './signal.js';
import { registrableDomain, toUnicodeHost, domainLabel } from '../core/url.js';
import { isWellKnown } from '../core/reference.js';
import { unicodeToAsciiSkeleton, scriptOf } from '../core/confusables.js';

export const id = 'homoglyph-idn';

export function mixedScriptLabel(unicodeHost) {
  for (const label of unicodeHost.split('.')) {
    const scripts = new Set();
    for (const ch of label) {
      const s = scriptOf(ch);
      if (s !== 'common') scripts.add(s);
    }
    if (scripts.has('latin') && (scripts.has('cyrillic') || scripts.has('greek') || scripts.has('armenian'))) return label;
  }
  return null;
}

// If the rendered host imitates a well-known domain, return that domain.
export function findHomoglyphTarget(host, ctx) {
  const unicode = toUnicodeHost(host);
  if (unicode === host) return null; // pure ASCII, nothing to imitate with
  const labels = unicode.split('.').map((l) => unicodeToAsciiSkeleton(l));
  if (labels.includes(null)) return null; // some character has no ASCII twin
  const skeleton = labels.join('.');
  const reg = registrableDomain(skeleton);
  if (reg !== registrableDomain(host) && isWellKnown(ctx, reg)) return reg;
  // "аррӏе.ru": the name imitates a well-known name on another TLD.
  const label = domainLabel(reg);
  if (label.length >= 4 && ctx?.labelOwners?.has(label) && domainLabel(registrableDomain(unicode)) !== label) {
    return ctx.labelOwners.get(label);
  }
  return null;
}

export function check({ url }, ctx) {
  if (!url.host.split('.').some((l) => l.startsWith('xn--'))) return [];
  const out = [signal('idn.punycode', 'lookalike', url.host, `Internationalised domain; displayed as "${url.hostUnicode}"`)];
  const target = findHomoglyphTarget(url.host, ctx);
  if (target) {
    out.push(signal('homoglyph.lookalike', 'lookalike', url.hostUnicode, `"${url.hostUnicode}" uses look-alike characters to imitate "${target}" (real address: ${url.host})`));
  }
  const mixed = mixedScriptLabel(url.hostUnicode);
  if (mixed) {
    out.push(signal('homoglyph.mixed_script', 'lookalike', mixed, `"${mixed}" mixes Latin letters with another alphabet`));
  }
  return out;
}
