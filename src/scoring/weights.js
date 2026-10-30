// THE weight table. Every signal id a check can emit must be listed here;
// tests enforce that. Checks read their weight from here and the scorer
// reads thresholds from here. Change numbers in this file only.
//
// (A .js module rather than .json so it can carry these comments and load
// without JSON-module import attributes in the service worker.)

export const WEIGHTS = {
  // Threat-intel feeds. Any hit makes the tier "malicious" regardless of score.
  'feed.url_match': 100,
  'feed.host_match': 100,

  // Lookalike domains.
  'typosquat.edit_distance': 60, // 1-2 character edit from a well-known domain
  'typosquat.visual_swap': 70, // rn->m, 0->o, 1->l style swap of a well-known domain
  'homoglyph.lookalike': 80, // IDN that renders like a well-known domain
  'homoglyph.mixed_script': 50, // one label mixes Latin with Cyrillic/Greek etc.
  'idn.punycode': 10, // host uses punycode at all (informational)

  // Brand claims on unrelated domains.
  'brand.in_domain': 50, // "sbi-login.xyz"
  'brand.in_subdomain': 55, // "paypal.com.account-check.ru"
  'brand.in_path': 10, // "/hdfc/login" on an unrelated domain (weak)

  // URL structure.
  'url.ip_host': 40,
  'url.at_sign': 40, // user-info trick: https://google.com@evil.tld/
  'url.many_subdomains': 15,
  'url.odd_tld': 15,
  'url.long': 10,
  'url.nonstandard_port': 10,
  'url.insecure_http': 5,
  'url.credential_words': 10,

  'shortener.known': 15,

  // Anchor text shows one domain, href opens another.
  'link.text_mismatch': 45,

  // Email sender (Gmail).
  'sender.display_name_email_mismatch': 40, // display name shows a different address
  'sender.display_brand_mismatch': 50, // display name says "SBI", domain isn't SBI's
  'sender.freemail_brand': 45, // brand claim from gmail.com etc.
  'sender.reply_to_mismatch': 30,
  'sender.lookalike_domain': 70,

  // Cracked / pirated software. Together these must stay below the High
  // threshold (a test enforces it): tooltip only, never a warning page.
  'software.piracy-list': 35, // host on a pirated-software list
  'software.piracy-keywords': 20, // 2+ of crack, keygen, activator, ...
  'software.risky-download': 10, // .exe/.msi/.zip/.iso/.scr/.apk off well-known sites
};

// Score is the sum of distinct signal weights, capped at 100.
export const THRESHOLDS = {
  suspicious: 30,
  high: 70,
};

// Categories whose signals force the "malicious" tier.
export const MALICIOUS_CATEGORIES = new Set(['feed']);

export const TIERS = ['none', 'suspicious', 'high', 'malicious'];

// User-visible wording. Never "safe".
export const TIER_LABELS = {
  none: 'No known threats found',
  suspicious: 'Suspicious',
  high: 'High risk',
  malicious: 'Known malicious',
};

// Extra advice shown with a verdict when one of these signals is present.
// Never "safe"; doesn't claim the site itself carries malware.
export const ADVICE = {
  'software.piracy-list':
    'This site is listed as distributing cracked or pirated software, which commonly comes bundled with malware. Avoid downloading from it. Use the official site or a trusted store.',
};

// Toolbar icon tooltip (per tab). "normal" = page not checked (not a web
// page, setting off, or the check failed). Never "safe".
export const TOOLBAR_TITLES = {
  normal: 'Aspida settings',
  none: 'Aspida: No known threats found for this site (click for settings)',
  suspicious: 'Aspida: Suspicious signs on this site (click for settings)',
  high: 'Aspida: High risk site (click for settings)',
  malicious: 'Aspida: Known malicious site (click for settings)',
};
