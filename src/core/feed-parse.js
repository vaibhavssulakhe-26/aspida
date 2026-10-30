// Pure feed parsers: text -> { urls: string[] (feedUrlKey), hosts: string[] }.
// Malformed lines are skipped, never thrown on.

import { feedUrlKey, normalizeHost } from './url.js';

const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function addUrl(out, raw) {
  const key = feedUrlKey(raw);
  if (!key) return;
  // A bare-domain URL ("http://evil.top/") blocks the whole host.
  if (!key.includes('/') && !key.includes('?')) out.hosts.add(key.split(':')[0]);
  else out.urls.add(key);
}

function addHost(out, raw) {
  const h = normalizeHost(raw);
  if (HOST_RE.test(h)) out.hosts.add(h);
}

// Minimal CSV line splitter for URLhaus ("a","b","c" with "" escapes).
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseFeed(format, text) {
  const out = { urls: new Set(), hosts: new Set() };
  const lines = String(text).split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (format === 'url-list') addUrl(out, t);
    else if (format === 'domain-list') addHost(out, t);
    else if (format === 'mixed') (t.includes('://') ? addUrl : addHost)(out, t);
    else if (format === 'urlhaus-csv') {
      // id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
      const cols = splitCsvLine(t);
      if (cols.length >= 3 && cols[0] !== 'id') addUrl(out, cols[2]);
    }
  }
  return { urls: [...out.urls], hosts: [...out.hosts] };
}
