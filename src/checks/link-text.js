// Link text that looks like an address but points somewhere else:
//   <a href="https://evil.example/">www.hdfcbank.com</a>
// Needs input.linkText (visible text of the anchor); silent without it.

import { signal } from './signal.js';
import { registrableDomain, normalizeHost } from '../core/url.js';

export const id = 'link-text';

const URLISH = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#]\S*)?$/i;

export function hostShownIn(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 300 || /\s/.test(t)) return null;
  const m = URLISH.exec(t);
  return m ? normalizeHost(m[1]) : null;
}

export function check({ url, linkText }) {
  const shown = hostShownIn(linkText);
  if (!shown) return [];
  const shownReg = registrableDomain(shown);
  if (shownReg === url.registrable) return [];
  return [signal('link.text_mismatch', 'deception', linkText.trim(), `Link text shows ${shownReg} but it opens ${url.registrable}`)];
}
