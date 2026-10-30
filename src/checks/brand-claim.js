// Brand keyword on a domain the brand does not own, e.g. "sbi-login.xyz"
// or "paypal.com.verify-account.ru". Produces evidence like
// 'claims to be SBI but domain is not sbi.co.in'.
//
// Also exported: findBrandClaim(text, brands) for display names (sender checks).

import { signal } from './signal.js';
import { subdomainLabels, domainLabel, tldOf, publicSuffixOf } from '../core/url.js';
import { isWellKnown } from '../core/reference.js';
import { asciiSkeleton } from '../core/confusables.js';
import { CREDENTIAL_WORDS, ODD_TLDS, HOSTING_SUFFIXES } from '../config/lists.js';

export const id = 'brand-claim';

const CRED = CREDENTIAL_WORDS.map((w) => w.replace(/[^a-z0-9]/g, ''));

// Does this piece of text (a label, path segment or display name) mention
// the keyword? Short keywords need an exact token (or keyword+"login" style
// compounds); long keywords may appear inside a token.
export function mentions(text, keyword) {
  const kw = keyword.replace(/[^a-z0-9]/g, '');
  const lower = String(text).toLowerCase();
  const raw = lower.split(/[^a-z0-9]+/).filter(Boolean);
  // Also try each token with visual swaps undone: "arnazon" -> "amazon".
  const tokens = [...new Set([...raw, ...raw.map(asciiSkeleton)])];
  for (const t of tokens) {
    if (t === kw) return true;
    if (kw.length >= 5 && t.startsWith(kw)) return true;
    if (t.startsWith(kw) && CRED.includes(t.slice(kw.length))) return true;
    if (t.endsWith(kw) && CRED.includes(t.slice(0, t.length - kw.length))) return true;
  }
  if (kw.length >= 5 && lower.replace(/[^a-z0-9]/g, '').startsWith(kw)) return true;
  return false;
}

export function findBrandClaim(text, brands) {
  for (const brand of brands) {
    if (brand.keywords.some((k) => mentions(text, k))) return brand;
  }
  return null;
}

export function ownsDomain(brand, registrable) {
  return brand.domains.includes(registrable);
}

function claimDetail(brand, where) {
  return `${where} claims to be ${brand.name} but the domain is not ${brand.domains[0]}`;
}

export function check({ url }, ctx) {
  if (url.isIp || !ctx || isWellKnown(ctx, url.registrable)) return [];
  const brands = ctx.brands;
  const regLabel = domainLabel(url.registrable);
  const out = [];

  let brand = findBrandClaim(regLabel, brands);
  // "amazon.eu", "outlook.cn": the bare brand name on another ordinary TLD
  // is usually a defensive registration by the brand itself. Only flag it on
  // TLDs that are popular with abusers or on hosting-platform tenants.
  if (brand && brand.keywords.includes(regLabel) && !ODD_TLDS.has(tldOf(url.host)) && !HOSTING_SUFFIXES.has(publicSuffixOf(url.registrable))) {
    brand = null;
  }
  if (brand && !ownsDomain(brand, url.registrable)) {
    out.push(signal('brand.in_domain', 'brand', url.registrable, claimDetail(brand, `"${url.registrable}"`)));
    return out;
  }
  const subs = subdomainLabels(url.host, url.registrable).join('.');
  brand = subs ? findBrandClaim(subs, brands) : null;
  if (brand && !ownsDomain(brand, url.registrable)) {
    out.push(signal('brand.in_subdomain', 'brand', subs, claimDetail(brand, `Subdomain "${subs}"`) + ` (real domain: ${url.registrable})`));
    return out;
  }
  // Path: exact token only, and only a weak signal.
  for (const seg of url.path.split('/').filter(Boolean)) {
    brand = brands.find((b) => b.keywords.some((k) => seg.toLowerCase().split(/[^a-z0-9]+/).includes(k)));
    if (brand && !ownsDomain(brand, url.registrable)) {
      out.push(signal('brand.in_path', 'brand', `/${seg}`, claimDetail(brand, `Path "/${seg}"`)));
      break;
    }
  }
  return out;
}
