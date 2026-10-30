// Threat-feed sources. See FEEDS.md for verification notes and licences.
// Only hosts listed here are ever contacted (and they are the only
// host_permissions in manifest.json).
//
// format: 'url-list'    one URL per line (OpenPhish)
//         'domain-list' one hostname per line (Phishing.Database)
//         'urlhaus-csv' URLhaus CSV export (quoted, '#' comments)
//         'mixed'       bundled sample: URLs or hostnames, '#' comments

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
    id: 'urlhaus',
    name: 'URLhaus (abuse.ch) recent',
    // abuse.ch requires a free personal Auth-Key in the path since 2025.
    urlTemplate: 'https://urlhaus-api.abuse.ch/v2/files/exports/{key}/recent.csv',
    needsKey: true,
    format: 'urlhaus-csv',
    refreshHours: 6,
    license: 'abuse.ch fair-use terms; free Auth-Key required (abuse.ch/terms-of-use).',
  },
];

export const FEED_ALARM = 'aspida-feed-refresh';
export const FEED_ALARM_PERIOD_MINUTES = 60; // wake hourly; each feed refreshes when due
