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

// ---- Report sender (opened email) ------------------------------------------
// Senders are reported only for these tiers (the sender checks never produce
// "Known malicious" on their own).
export const SENDER_REPORT_TIERS = new Set(['suspicious', 'high']);

const ADDRESS_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

// { address, displayName } as shown in the confirm step, or null if the
// address doesn't look like one. The display name is trimmed and capped (it
// is attacker-controlled text, shown with textContent only).
export function reportableSender(sender) {
  const address = String(sender?.address || '').trim();
  if (!ADDRESS_RE.test(address) || address.length > 254) return null;
  const name = String(sender?.displayName || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return { address, displayName: name && name !== address ? name : '' };
}

// userInitiated: the user clicked "Think this is suspicious? Report" on an
// email Aspida found nothing wrong with, so a "none" sender may be reported
// too (to report what Aspida missed). The button itself still appears only
// for Suspicious / High senders.
export function canReportSender(verdict, sender, { userInitiated = false } = {}) {
  if (!reportableSender(sender)) return false;
  const tier = verdict?.tier || 'none';
  return SENDER_REPORT_TIERS.has(tier) || (userInitiated && tier === 'none');
}

// Which report controls an opened-email banner gets. Pure, so the decision
// (and the reason for each skipped control, for the debug log) is testable.
//   summaryTier: the banner's combined tier; senderVerdict: sender verdict or
//   null; sender: { address, displayName }; reportOn: settings.reportButton;
//   hasKey: a per-email key exists (needed to remember Minimize).
// Returns { minimize, reportSender, reportMissed, inlineLinks, skipped: {control: reason} }.
export function bannerReportPlan({ summaryTier, senderVerdict, sender, reportOn = true, hasKey = true }) {
  const warn = summaryTier !== 'none';
  const skipped = {};
  const plan = { minimize: false, reportSender: false, reportMissed: false, inlineLinks: false, skipped };
  if (!warn) skipped.minimize = 'tier none';
  else if (!hasKey) skipped.minimize = 'no key';
  else plan.minimize = true;
  const okSender = !!reportableSender(sender);
  for (const [control, wanted, ok] of [
    ['reportSender', warn && SENDER_REPORT_TIERS.has(senderVerdict?.tier), okSender],
    ['reportMissed', !warn, okSender],
    ['inlineLinks', warn, true],
  ]) {
    if (!reportOn) skipped[control] = 'setting off';
    else if (!wanted) skipped[control] = control === 'reportSender' ? `sender tier ${senderVerdict?.tier || 'none'}` : warn ? 'tier flagged' : 'tier none';
    else if (!ok) skipped[control] = 'no sender address';
    else plan[control] = true;
  }
  return plan;
}

// Links offered in the "report what Aspida missed" step: up to `max` distinct
// http(s) URLs, stripped of credentials, query and #fragment.
export function pickerLinks(urls, max = 5) {
  const out = [];
  for (const u of urls || []) {
    const r = reportableUrl(typeof u === 'string' ? u : u?.url);
    if (r && !out.includes(r)) out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

// Destination page for a sender report: the plain form (no prefill; the UI
// copies the address first). null for an unknown destination.
export function senderDestinationUrl(id) {
  return REPORT_DESTINATIONS.find((x) => x.id === id)?.base || null;
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
