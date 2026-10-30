// Static reference lists used by the pure checks. Plain data, no logic.
// Edit freely; every list is documented with why it exists.

// Multi-label public suffixes. We do not ship the full Public Suffix List
// (~250 KB); this covers the ccTLD second levels that matter for the brands
// and regions we target. Unknown suffixes fall back to "last label".
export const MULTI_PART_SUFFIXES = new Set([
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'edu.in', 'res.in', 'nic.in', 'firm.in', 'gen.in', 'ind.in',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'com.mx', 'com.tr', 'com.sg', 'com.my', 'com.pk', 'com.bd', 'com.np', 'com.lk',
  'com.ar', 'com.co', 'com.eg', 'com.sa', 'com.tw', 'com.hk', 'com.ua', 'com.vn', 'com.ph',
  'co.za', 'co.nz', 'co.kr', 'co.id', 'co.th', 'co.il', 'co.ke',
]);

// Shared-hosting / free-subdomain platforms. Treated as public suffixes so
// that "evil.vercel.app" is its own registrable domain and is NOT covered by
// "vercel.app" being a popular (top-list) domain. Phishing kits live here a lot.
export const HOSTING_SUFFIXES = new Set([
  'vercel.app', 'netlify.app', 'github.io', 'gitlab.io', 'pages.dev', 'workers.dev',
  'web.app', 'firebaseapp.com', 'appspot.com', 'herokuapp.com', 'onrender.com',
  'glitch.me', 'repl.co', 'replit.app', 'replit.dev', 'surge.sh', 'fly.dev',
  '000webhostapp.com', 'weebly.com', 'wixsite.com', 'blogspot.com', 'wordpress.com',
  'square.site', 'webflow.io', 'framer.app', 'framer.website', 'godaddysites.com',
  'azurewebsites.net', 'cloudfront.net', 'amazonaws.com', 'r2.dev', 'ngrok.io',
  'ngrok-free.app', 'trycloudflare.com', 'duckdns.org', 'no-ip.org', 'ddns.net',
  'myshopify.com', 'carrd.co', 'mystrikingly.com', 'jimdosite.com', 'sites.google.com',
  'ipfs.io', 'dweb.link', 'backblazeb2.com', 'firebasestorage.app',
]);

// URL shorteners. Presence is a weak signal only. We never expand them.
export const SHORTENERS = new Set([
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 't.ly', 'tiny.cc', 'bl.ink',
  'lnkd.in', 's.id', 'v.gd', 'qr.ae', 'shorte.st', 'adf.ly', 'bit.do', 'clck.ru',
  'u.to', 'x.co', 'soo.gd', 'short.io', 'tny.im', 'urlz.fr', 'surl.li', 'linktr.ee',
  'wa.me', 'rzp.io', 'hyperurl.co', 'shorturl.asia', 'gg.gg', 'trib.al', '2u.pm',
]);

// TLDs disproportionately used for abuse (Spamhaus / Interisle reports).
// Weak signal on its own; only meaningful in combination.
export const ODD_TLDS = new Set([
  'zip', 'mov', 'xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'icu', 'buzz', 'rest',
  'cyou', 'sbs', 'click', 'link', 'country', 'kim', 'work', 'support', 'live',
  'monster', 'quest', 'cam', 'bond', 'cfd', 'lol', 'shop', 'online', 'site', 'store',
  'fit', 'loan', 'win', 'bid', 'date', 'review', 'party', 'science', 'racing',
  'download', 'stream', 'gdn', 'mom', 'beauty', 'hair', 'skin', 'autos', 'boats',
]);

// Words common in credential-harvesting URLs. Only adds weight to other signals.
export const CREDENTIAL_WORDS = [
  'login', 'signin', 'sign-in', 'logon', 'verify', 'verification', 'update', 'secure',
  'account', 'kyc', 'otp', 'wallet', 'unlock', 'suspend', 'confirm', 'reward', 'refund',
  'password', 'netbanking', 'banking', 'auth', 'validate', 'recover', 'billing',
];

// Free email providers. A "company" mail from one of these is a classic lure.
export const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'ymail.com', 'outlook.com',
  'hotmail.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mail.com',
  'gmx.com', 'gmx.net', 'proton.me', 'protonmail.com', 'zoho.com', 'zohomail.in',
  'yandex.com', 'yandex.ru', 'rediffmail.com', 'tutanota.com', 'mail.ru', 'qq.com',
  '163.com', 'inbox.com', 'fastmail.com', 'hushmail.com',
]);
