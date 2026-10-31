# Threat feeds

All feeds are downloaded as whole files and matched **locally**. Aspida never
sends a URL you visit, hover or receive to any feed provider. Downloads use
`credentials: 'omit'`, `referrerPolicy: 'no-referrer'` and `cache: 'no-store'`.

Verified on **2026-10-30** from this machine (HTTP status, format, size, licence
text). Re-check before any non-hackathon use.

## OpenPhish Community feed (enabled by default)

| | |
|---|---|
| URL used | `https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt` |
| Also | `https://openphish.com/feed.txt` returns `302` to the URL above |
| Status | `200`, `text/plain`, `Access-Control-Allow-Origin: *` |
| Format | One phishing URL per line (300 lines, ~15 KB on the check date) |
| Upstream refresh | Every 12 hours (per the repo README) |
| Aspida refresh | Every 6 hours |
| Licence / terms | "Non-commercial use only"; by using it you agree to https://openphish.com/terms.html |
| Parsing | URLs → full-URL entries (scheme-less, lowercase host, no fragment/trailing slash). Bare-domain URLs like `http://evil.top/` are stored as host entries |

## Phishing.Database, active domains (enabled by default)

| | |
|---|---|
| URL used | `https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt` (the old `mitchellkrogza/Phishing.Database` path serves the same file) |
| Status | `200`, `text/plain`, `Access-Control-Allow-Origin: *` |
| Format | One hostname per line; 392,178 lines (~11 MB) on the check date |
| Aspida refresh | Every 24 hours (it is large) |
| Licence | MIT, © Mitchell Krog |
| Notes | Stored as host entries; a host matches itself and its subdomains up to the registrable domain. The `phishing-links-ACTIVE.txt` list (~66 MB) is deliberately **not** used: too large for a browser extension. Hits on well-known (top-10k) domains are ignored, so a listing of a shared host can't flag all of it |
| Import cost | ~9 s to store 391,548 hosts in IndexedDB; ~2–3 ms per lookup |

## Bundled demo feed (always available, offline)

`data/sample-feed.txt`: a few synthetic hosts and URLs under the reserved
`.test` / `.invalid` TLDs (RFC 2606 / 6761), so the warning page and "Known
malicious" verdicts can be demonstrated with no network and no real phishing
site. MIT.

## Pirated-software category (not a threat feed)

Separate from the threat feeds above: hits here never make a site "Known
malicious" and never open the warning page. They only add the
`software.piracy-list` signal (Suspicious at most, tooltip only; see README).
Turned off together with the "Cracked / pirated software" setting (then the
lists are neither used nor downloaded). Sources checked on **2026-10-31**:

| Source | Checked | Result |
|---|---|---|
| **HaGeZi Anti-Piracy, domains only** (used) | `https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/anti.piracy-onlydomains.txt` | `200`, `text/plain`, ~1.1 MB, 57,946 domains, `#` header ("Syntax: Domains (without subdomains)", "Last modified: 30 Oct 2026 10:10 UTC", "Expires: 8 hours"). Licence **GPL-3.0** (repo `LICENSE`). Hosted on `raw.githubusercontent.com`, already in `host_permissions`, so **no new permission**. Covers piracy in general (software, games, film/TV streaming, some file hosts), not only software |
| HaGeZi `domains/anti.piracy.txt` | same repo | `404` (that path doesn't exist; the domains-only list is under `wildcard/`) |
| **UT1 blacklists, `warez` category** (not used) | `https://dsi.ut-capitole.fr/blacklists/download/warez.tar.gz` | `200`, 9.6 KB gzip tar with `warez/domains` (1,554 domains), `urls`, `expressions`; `Last-Modified: 30 Oct 2026`. Would need a **new host permission** and tar parsing; licence page returned `503` on the check date, so its licence was not re-verified |
| UT1 GitHub mirror (`olbat/ut1-blacklists`, `blacklists/warez/domains`) (not used) | raw.githubusercontent.com | `200`, 1,546 domains, but last updated **2026-04-12** (stale) |

| | |
|---|---|
| Aspida refresh | HaGeZi every 24 hours |
| Parsing | `domain-list`: one host per line, `#` comments skipped. A host matches itself and its subdomains up to the registrable domain, like the threat feeds |
| Exemptions | Hits on top-10k domains are ignored (e.g. `mega.nz`, `mediafire.com`, and some popular piracy sites such as `fitgirl-repacks.site` are on the list but in the top 10k, so never flagged). Your allowlist wins |
| Bundled demo list | `data/sample-piracy.txt`: synthetic `.test` hosts for the offline demo (MIT) |

Because the list covers more than software, the tooltip's wording ("listed as
distributing cracked or pirated software") is broader than some listed sites
deserve; the evidence line always names the source list.

## Reference list (not a threat feed)

`data/top-domains.txt`: the top 10,000 domains of the Tranco list, list ID
**PYK6J** (downloaded 2026-10-30 from https://tranco-list.eu/). It is used as
(a) the reference set for typosquat/homoglyph comparison and (b) the
never-flag set for heuristic checks. Tranco is free to use; cite Le Pochat et
al., "Tranco: A Research-Oriented Top Sites Ranking Hardened Against
Manipulation", NDSS 2019.

## Failure handling

- A failed or empty download keeps the previous generation active ("last good
  copy"); the options page shows `Last attempt failed: … (keeping last good copy)`.
- After a failure a feed is not retried for an hour by the scheduler (manual
  **Refresh** always tries).
- Disabling a feed deletes its entries; re-enabling downloads it again.
