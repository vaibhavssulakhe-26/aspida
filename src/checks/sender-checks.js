// Email sender checks (Gmail). Input is whatever the mail UI exposes:
//   { displayName, address, replyTo }   (replyTo may be empty/unknown)
// Reuses the lookalike/brand logic from the URL checks on the sender domain.

import { signal } from './signal.js';
import { registrableDomain, normalizeHost, domainLabel } from '../core/url.js';
import { isWellKnown } from '../core/reference.js';
import { findLookalike } from './typosquat.js';
import { findHomoglyphTarget } from './homoglyph-idn.js';
import { findBrandClaim, ownsDomain } from './brand-claim.js';
import { FREEMAIL_DOMAINS } from '../config/lists.js';

export const id = 'sender-checks';

const EMAIL_RE = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i;

export function domainOfAddress(address) {
  const m = EMAIL_RE.exec(String(address || ''));
  return m ? normalizeHost(m[1]) : '';
}

export function check({ displayName = '', address = '', replyTo = '' }, ctx) {
  const out = [];
  const domain = domainOfAddress(address);
  if (!domain) return out;
  const reg = registrableDomain(domain);
  const name = String(displayName).trim();

  // 1. Display name shows a different email address than the real sender.
  const shown = EMAIL_RE.exec(name);
  if (shown && registrableDomain(normalizeHost(shown[1])) !== reg) {
    out.push(signal('sender.display_name_email_mismatch', 'sender', shown[0], `Name shows "${shown[0]}" but the mail is really from ${address}`));
  }

  // 2. Display name claims a brand the sending domain doesn't belong to.
  const brand = name ? findBrandClaim(name, ctx.brands) : null;
  if (brand && !ownsDomain(brand, reg)) {
    if (FREEMAIL_DOMAINS.has(reg)) {
      out.push(signal('sender.freemail_brand', 'sender', `${name} <${address}>`, `Claims to be ${brand.name} but is sent from a free ${reg} mailbox`));
    } else {
      out.push(signal('sender.display_brand_mismatch', 'sender', name, `Name claims to be ${brand.name} but the sender domain is ${reg}, not ${brand.domains[0]}`));
    }
  }

  // 3. Sender domain itself contains a brand it doesn't own ("sbi-alerts.com").
  if (!isWellKnown(ctx, reg) && !FREEMAIL_DOMAINS.has(reg)) {
    const domainBrand = findBrandClaim(domainLabel(reg), ctx.brands);
    if (domainBrand && !ownsDomain(domainBrand, reg) && domainBrand !== brand) {
      out.push(signal('brand.in_domain', 'brand', reg, `Sender domain "${reg}" claims to be ${domainBrand.name} but is not ${domainBrand.domains[0]}`));
    }
  }

  // 4. Lookalike sender domain.
  const homoglyph = findHomoglyphTarget(domain, ctx);
  const lookalike = homoglyph ? { target: homoglyph } : findLookalike(reg, ctx);
  if (lookalike) {
    out.push(signal('sender.lookalike_domain', 'lookalike', reg, `Sender domain "${reg}" imitates "${lookalike.target}"`));
  }

  // 5. Replies go somewhere else.
  const replyDomain = domainOfAddress(replyTo);
  if (replyDomain && registrableDomain(replyDomain) !== reg) {
    out.push(signal('sender.reply_to_mismatch', 'sender', replyTo, `Replies would go to ${registrableDomain(replyDomain)}, not the sender's domain ${reg}`));
  }
  return out;
}
