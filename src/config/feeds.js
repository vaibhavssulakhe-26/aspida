// Threat-feed sources. See FEEDS.md for verification notes and licences.
// Only hosts listed here are ever contacted (and they are the only
// host_permissions in manifest.json).
//
// format: 'url-list'    one URL per line (OpenPhish)
//         'domain-list' one hostname per line (Phishing.Database)
//         'mixed'       bundled sample: URLs or hostnames, '#' comments
//
// category: 'phishing' (default; any hit = "Known malicious") or 'piracy'
// (pirated-software lists; only the software check reads these hits).
// requires: a settings flag that must also be on for the feed to be used
// and downloaded.

export const FEEDS = [
  {
    id: 'sample',
    name: 'Bundled demo feed',
    bundled: 'data/sample-feed.txt',
    format: 'mixed',
    refreshHours: 0, // never downloaded; loaded from the extension package
    license: 'Synthetic entries written for this project (MIT).',
  },
  {
    id: 'openphish',
    name: 'OpenPhish Community',
    url: 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt',
    format: 'url-list',
    refreshHours: 6, // upstream updates every 12 h
    license: 'OpenPhish Community Feed: free for non-commercial use (openphish.com/terms.html).',
  },
  {
    id: 'phishing-database',
    name: 'Phishing.Database (active domains)',
    url: 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt',
    format: 'domain-list',
    refreshHours: 24, // ~11 MB, so refresh daily rather than every 6 h
    license: 'MIT (Mitchell Krog, Phishing.Database).',
  },
  {
    id: 'piracy-sample',
    name: 'Bundled pirated-software demo list',
    bundled: 'data/sample-piracy.txt',
    format: 'domain-list',
    category: 'piracy',
    requires: 'softwareChecks',
    refreshHours: 0,
    license: 'Synthetic .test entries written for this project (MIT).',
  },
  {
    id: 'hagezi-piracy',
    name: "HaGeZi's Anti-Piracy (pirated software, warez)",
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/anti.piracy-onlydomains.txt',
    format: 'domain-list',
    category: 'piracy',
    requires: 'softwareChecks',
    refreshHours: 24, // ~1.1 MB, ~58k domains; upstream rebuilds several times a day
    license: 'GPL-3.0 (HaGeZi dns-blocklists).',
  },
];

export const feedCategory = (feed) => feed?.category || 'phishing';

// A feed is used (downloaded and looked up) only when its own toggle and its
// required setting are both on.
export function feedEnabled(feed, settings) {
  return !!settings?.feeds?.[feed.id] && (!feed.requires || !!settings[feed.requires]);
}

export const FEED_ALARM = 'aspida-feed-refresh';
export const FEED_ALARM_PERIOD_MINUTES = 60; // wake hourly; each feed refreshes when due
