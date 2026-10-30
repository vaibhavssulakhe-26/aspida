// Turns local feed lookup results into signals. The lookup itself (IndexedDB)
// happens in the background worker; this module only interprets the hits so
// it stays pure and testable.
//
// input.feedHits: [{ source: 'openphish', kind: 'url' | 'host', value, category }]
// Only threat feeds count here; other categories (pirated software) have
// their own check and never make a site "Known malicious".

import { signal } from './signal.js';

export const id = 'feed-match';

export function check({ url, feedHits = [] }) {
  const out = [];
  const seen = new Set();
  for (const hit of feedHits) {
    if (hit.category && hit.category !== 'phishing') continue;
    const key = `${hit.kind}|${hit.value}|${hit.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (hit.kind === 'url') {
      out.push(signal('feed.url_match', 'feed', url.href, `This exact URL is listed by ${hit.source}`));
    } else {
      out.push(signal('feed.host_match', 'feed', hit.value, `Domain "${hit.value}" is listed by ${hit.source}`));
    }
  }
  return out;
}
