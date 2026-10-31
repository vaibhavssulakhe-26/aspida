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
  toolbarIcon: true, // toolbar icon colour follows the current site's verdict
  softwareChecks: true, // cracked/pirated software signals (tooltip only)
  reportButton: true, // "Report this link" in risky tooltips and the warning page
  uiLanguage: 'en', // interface language: 'en' or 'kn' (draft); reasons stay English
  theme: 'auto', // settings page colours: 'auto' (follows the system), 'light' or 'dark'
  feeds: {
    sample: true, // bundled demo feed (offline)
    openphish: true,
    'phishing-database': true,
    'piracy-sample': true, // bundled pirated-software demo list (offline)
    'hagezi-piracy': true,
  },
  debug: false, // verbose console.debug from content scripts
};

export const THEMES = ['auto', 'light', 'dark'];

// Keys from earlier versions that no longer mean anything (the URLhaus feed
// and its Auth-Key were removed).
const REMOVED_KEYS = ['urlhausAuthKey'];
export const REMOVED_FEEDS = ['urlhaus'];

// Stored settings without the removed keys. changed: whether anything was
// dropped, so the caller knows to write the result back.
export function migrateSettings(stored) {
  const s = { ...(stored || {}) };
  let changed = false;
  for (const k of REMOVED_KEYS) {
    if (Object.hasOwn(s, k)) {
      delete s[k];
      changed = true;
    }
  }
  if (s.feeds && typeof s.feeds === 'object') {
    s.feeds = { ...s.feeds };
    for (const id of REMOVED_FEEDS) {
      if (Object.hasOwn(s.feeds, id)) {
        delete s.feeds[id];
        changed = true;
      }
    }
  }
  return { settings: s, changed };
}

export function mergeSettings(stored) {
  const clean = migrateSettings(stored).settings;
  const s = { ...DEFAULT_SETTINGS, ...clean };
  s.feeds = { ...DEFAULT_SETTINGS.feeds, ...(clean.feeds || {}) };
  if (!THEMES.includes(s.theme)) s.theme = 'auto';
  return s;
}
