// Writes docs/KANNADA_STRINGS_REVIEW.md from the string tables, for a native
// speaker to review. Dev tool, not shipped. Run: node tools/kannada-review.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import en from '../src/config/strings/en.js';
import kn from '../src/config/strings/kn.js';

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const groups = new Map();
for (const key of Object.keys(en)) {
  const g = key.split('.')[0];
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(key);
}
const TITLES = {
  tier: 'Verdict tiers', verdict: 'Tooltip and banner text', badge: 'Chat badge', banner: 'Gmail banner', qr: 'QR tooltip',
  advice: 'Advice', toolbar: 'Toolbar icon tooltip', warning: 'Warning page', options: 'Settings page', ago: 'Relative times',
  stat: 'Local counters', feature: 'Feature switches',
};

let out = `# Kannada interface strings: review sheet (DRAFT)

The Kannada (ಕನ್ನಡ) interface strings in \`src/config/strings/kn.js\` are a
**DRAFT** machine-assisted translation. They need review by a native speaker
before being relied on. Please check meaning, tone (plain, calm, not alarmist)
and natural word choice, and suggest edits in the "Kannada (draft)" column.

Rules for reviewers:

- Never translate "No known threats found" as "safe" (ಸುರಕ್ಷಿತ); Aspida never
  claims a site is safe. A unit test rejects ಸುರಕ್ಷಿತ.
- Keep \`{placeholders}\` exactly as they are (a test checks this).
- "Aspida" is the product name and stays in Latin letters. Brand and product
  names (Gmail, WhatsApp Web, UPI, OTP, SPF/DKIM/DMARC, "show details")
  are kept as written.
- Reason sentences produced by the checks (e.g. "Link text shows X but it opens
  Y") are **not** translated in this version and stay in English.

Regenerate this file after changing either table: \`node tools/kannada-review.mjs\`.
${Object.keys(en).length} strings.
`;
for (const [g, keys] of groups) {
  out += `\n## ${TITLES[g] || g}\n\n| Key | English (source) | Kannada (draft) |\n|---|---|---|\n`;
  for (const k of keys) out += `| \`${k}\` | ${cell(en[k])} | ${cell(kn[k] ?? '(missing: English shown)')} |\n`;
}
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/KANNADA_STRINGS_REVIEW.md', import.meta.url), out);
console.log(`wrote docs/KANNADA_STRINGS_REVIEW.md (${Object.keys(en).length} strings)`);
