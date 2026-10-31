// "Report this link": pure helpers. Nothing here sends anything; the UI
// shows the URL, the user picks a destination, and the browser opens it in a
// new tab (or the text is copied). Destination URLs are built only here, from
// a fixed list, so no other code can ask for an arbitrary tab to be opened.

export const REPORTABLE_TIERS = new Set(['suspicious', 'high', 'malicious']);

export const ISSUES_URL = 'https://github.com/vaibhavssulakhe-26/aspida/issues/new';

// prefill: the destination reads the URL from its own query string (checked
// 2026-10-31: Safe Browsing's report form fills its URL field from ?url=;
// Netcraft's form and cybercrime.gov.in do not, so the UI copies the URL
// first and says so).
export const REPORT_DESTINATIONS = [
  { id: 'safebrowsing', base: 'https://safebrowsing.google.com/safebrowsing/report_phish/', prefill: 'url' },
  { id: 'netcraft', base: 'https://report.netcraft.com/report' },
  { id: 'cybercrime', base: 'https://cybercrime.gov.in/' },
];

export function canReport(verdict) {
  return !!verdict && REPORTABLE_TIERS.has(verdict.tier) && /^https?:\/\//i.test(verdict.subject || '');
}

// The URL as it will be reported. User name/password are always removed;
// query string and #fragment too when strip is on (they often carry personal
// tokens: session ids, email addresses, tracking ids). null if not http(s).
export function reportableUrl(raw, { strip = true } = {}) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.username = '';
  u.password = '';
  if (strip) {
    u.search = '';
    u.hash = '';
  }
  return u.href;
}

// Where a destination button goes. Returns { url, prefilled } or null for an
// unknown destination or a non-http(s) target.
export function destinationUrl(id, target) {
  const d = REPORT_DESTINATIONS.find((x) => x.id === id);
  if (!d || !reportableUrl(target, { strip: false })) return null;
  if (!d.prefill) return { url: d.base, prefilled: false };
  const u = new URL(d.base);
  u.searchParams.set(d.prefill, target);
  return { url: u.href, prefilled: true };
}

// "Report a wrong warning": short text with the URL and the signal ids (no
// page content, no personal data beyond the URL the user chose to share).
export function wrongWarningText(target, verdict) {
  const ids = [...new Set((verdict?.reasons || []).map((r) => r.id))];
  return [
    'Aspida: possible wrong warning',
    `URL: ${target}`,
    `Tier: ${verdict?.tier || 'unknown'}`,
    `Signals: ${ids.join(', ') || 'none'}`,
  ].join('\n');
}

// New-issue page on the project's GitHub with that text prefilled.
export function wrongWarningIssueUrl(target, verdict) {
  const u = new URL(ISSUES_URL);
  u.searchParams.set('title', `Wrong warning: ${new URL(target).hostname}`);
  u.searchParams.set('body', `${wrongWarningText(target, verdict)}\n\nWhat did you expect instead?\n`);
  return u.href;
}
