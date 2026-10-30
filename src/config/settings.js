// Default settings. Every feature has a flag so it can be switched off
// quickly (e.g. on stage) without touching code. Stored in
// chrome.storage.local only; never storage.sync (that would upload the
// allowlist to the user's Google account).

export const DEFAULT_SETTINGS = {
  hoverVerdict: true, // tooltip on link hover, on all http(s) pages
  qrHover: true, // decode QR images on hover
  chatWhatsApp: true,
  chatTelegram: true,
  chatInstagram: true,
  chatInlineBadges: false, // persistent pill next to risky chat links (verdicts otherwise on hover only)
  gmailBanner: true, // banner on the opened email
  gmailInboxHighlight: false, // colour inbox rows (weak signal, opt-in)
  navigationGuard: true, // interstitial on known-malicious navigations
  blockHighRisk: true, // also interstitial on the "High risk" tier
  feeds: {
    sample: true, // bundled demo feed (offline)
    openphish: true,
    'phishing-database': true,
    urlhaus: false, // needs a free abuse.ch Auth-Key
  },
  urlhausAuthKey: '',
  debug: false, // verbose console.debug from content scripts
};

export function mergeSettings(stored) {
  const s = { ...DEFAULT_SETTINGS, ...(stored || {}) };
  s.feeds = { ...DEFAULT_SETTINGS.feeds, ...(stored?.feeds || {}) };
  return s;
}
