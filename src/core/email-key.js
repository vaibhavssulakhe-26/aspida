// Stable, short key for one opened email, used to remember UI choices (the
// minimized banner) for this browser session. Pure. Prefers Gmail's message
// id; otherwise sender address + subject. Hashed so the stored key carries
// no readable address or subject.

// 32-bit FNV-1a as 8 hex digits.
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    h ^= c & 0xff;
    h = Math.imul(h, 0x01000193);
    if (c > 0xff) {
      h ^= c >>> 8;
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const EMAIL_KEY_RE = /^[ms]:[0-9a-f]{16}$/;

// Two different FNV-1a seeds of the same text, so collisions need 64 bits.
const hash64 = (text) => fnv1a(text) + fnv1a(`aspida|${text}`);

export function emailKey({ messageId, address, subject } = {}) {
  const id = String(messageId || '').trim();
  if (id) return `m:${hash64(id)}`;
  const a = String(address || '').trim().toLowerCase();
  const s = String(subject || '').replace(/\s+/g, ' ').trim();
  if (!a && !s) return null;
  return `s:${hash64(`${a}\n${s}`)}`;
}
