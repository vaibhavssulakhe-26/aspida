// Character-level lookalike tables. Pure data + two small helpers.

// ASCII swaps that read the same at a glance in most fonts. Deliberately
// short: aggressive maps (i/l, cl/d) collide with real words and cause
// false positives.
const ASCII_SEQ_SWAPS = [
  ['rn', 'm'],
  ['vv', 'w'],
];
const ASCII_CHAR_SWAPS = { 0: 'o', 1: 'l' };

export function asciiSkeleton(label) {
  let s = label;
  for (const [from, to] of ASCII_SEQ_SWAPS) s = s.split(from).join(to);
  let out = '';
  for (const ch of s) out += ASCII_CHAR_SWAPS[ch] ?? ch;
  return out;
}

// Non-Latin characters that render like Latin letters (subset of Unicode
// TR39 confusables covering Cyrillic, Greek, Armenian and common symbols).
const UNICODE_TO_ASCII = {
  // Cyrillic
  'а': 'a', 'в': 'b', 'с': 'c', 'ԁ': 'd', 'е': 'e', 'ё': 'e', 'һ': 'h', 'і': 'i', 'ї': 'i',
  'ј': 'j', 'к': 'k', 'ӏ': 'l', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'ԛ': 'q', 'г': 'r',
  'ѕ': 's', 'т': 't', 'ц': 'u', 'ѵ': 'v', 'ԝ': 'w', 'х': 'x', 'у': 'y', 'ү': 'y', 'з': '3',
  // Greek
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p',
  'τ': 't', 'υ': 'u', 'χ': 'x', 'γ': 'y', 'ω': 'w',
  // Armenian
  'ա': 'w', 'հ': 'h', 'ո': 'n', 'ս': 'u', 'օ': 'o', 'ց': 'g', 'զ': 'q',
  // Latin extensions / IPA that look plain
  'ɑ': 'a', 'ɡ': 'g', 'ı': 'i', 'ł': 'l', 'ɩ': 'i', 'ʏ': 'y', 'ƅ': 'b', 'ɢ': 'g',
};

// Map a Unicode label to the ASCII it visually imitates. Diacritics are
// stripped (é -> e). Returns null if some character has no ASCII lookalike.
export function unicodeToAsciiSkeleton(label) {
  let out = '';
  for (const ch of label.normalize('NFD')) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x300 && cp <= 0x36f) continue; // combining marks
    if (cp < 0x80) {
      out += ch;
      continue;
    }
    const mapped = UNICODE_TO_ASCII[ch];
    if (!mapped) return null;
    out += mapped;
  }
  return out;
}

// Coarse script classification for mixed-script detection.
export function scriptOf(ch) {
  const cp = ch.codePointAt(0);
  if (cp < 0x80) return /[a-z]/i.test(ch) ? 'latin' : 'common';
  if (cp >= 0x00c0 && cp <= 0x024f) return 'latin';
  if (cp >= 0x0250 && cp <= 0x02af) return 'latin'; // IPA
  if (cp >= 0x0370 && cp <= 0x03ff) return 'greek';
  if (cp >= 0x0400 && cp <= 0x052f) return 'cyrillic';
  if (cp >= 0x0530 && cp <= 0x058f) return 'armenian';
  if (cp >= 0x0300 && cp <= 0x036f) return 'common';
  return 'other';
}
