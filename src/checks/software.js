// Cracked / pirated software. Weak-to-moderate signals that stay below the
// "High risk" threshold on their own (weights.js; a test enforces the
// ceiling). Never part of the "feed" category, so a piracy-list hit can't
// turn a site "Known malicious" or trigger the warning page.
//
// input.feedHits entries with category 'piracy' come from the pirated-
// software lists (local lookup, same matching as the threat feeds).

import { signal } from './signal.js';

export const id = 'software';

// Distinct weak words; two or more different ones are needed.
const KEYWORDS = [
  ['crack', /\bcrack(?:ed|s)?\b/],
  ['keygen', /\bkeygens?\b/],
  ['activator', /\bactivators?\b/],
  ['full version free download', /\bfull version (?:free )?download\b|\bfree download full version\b/],
  ['unlocked', /\bunlocked\b/],
  ['repack', /\brepack(?:s|ed)?\b/],
];

const RISKY_EXT = /\.(exe|msi|zip|iso|scr|apk)$/i;

// Lowercase words only: "Photoshop-CRACK_keygen.exe" -> "photoshop crack keygen exe".
const words = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

function pathOf(href) {
  try {
    return decodeURIComponent(new URL(href).pathname);
  } catch {
    return '';
  }
}

export function check({ url, feedHits = [], linkText }) {
  const out = [];
  const listed = feedHits.find((h) => h.category === 'piracy' && h.kind === 'host');
  if (listed) {
    out.push(signal('software.piracy-list', 'software', listed.value, `Listed in the pirated-software category (source: ${listed.source})`));
  }

  const path = pathOf(url.href);
  const text = words(`${url.hostUnicode || url.host} ${path} ${linkText || ''}`);
  const hits = KEYWORDS.filter(([, re]) => re.test(text)).map(([w]) => w);
  if (hits.length >= 2) {
    out.push(signal('software.piracy-keywords', 'software', hits.join(', '), `Words often used for cracked software: ${hits.join(', ')}`));
  }

  const file = path.split('/').pop();
  const ext = RISKY_EXT.exec(file)?.[1];
  if (ext) {
    out.push(signal('software.risky-download', 'software', file, `Direct download of a .${ext.toLowerCase()} file from a site that isn't well known`));
  }
  return out;
}
