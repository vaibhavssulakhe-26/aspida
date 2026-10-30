# Threat feeds

All feeds are downloaded as whole files and matched **locally**. TrustLens never
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
| TrustLens refresh | Every 6 hours |
| Licence / terms | "Non-commercial use only"; by using it you agree to https://openphish.com/terms.html |
| Parsing | URLs → full-URL entries (scheme-less, lowercase host, no fragment/trailing slash). Bare-domain URLs like `http://evil.top/` are stored as host entries |

## Phishing.Database, active domains (enabled by default)

| | |
|---|---|
| URL used | `https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt` (the old `mitchellkrogza/Phishing.Database` path serves the same file) |
| Status | `200`, `text/plain`, `Access-Control-Allow-Origin: *` |
| Format | One hostname per line; 392,178 lines (~11 MB) on the check date |
| TrustLens refresh | Every 24 hours (it is large) |
| Licence | MIT, © Mitchell Krog |
| Notes | Stored as host entries; a host matches itself and its subdomains up to the registrable domain. The `phishing-links-ACTIVE.txt` list (~66 MB) is deliberately **not** used: too large for a browser extension. Hits on well-known (top-10k) domains are ignored, so a listing of a shared host can't flag all of it |
| Import cost | ~9 s to store 391,548 hosts in IndexedDB; ~2–3 ms per lookup |

## URLhaus (abuse.ch) (disabled by default)

| | |
|---|---|
| Legacy URLs | `https://urlhaus.abuse.ch/downloads/text_online/`, `/csv_online/`, `/text/`, `/hostfile/` all return **`410 Gone`** on the check date |
| Current access | Exports require a free personal **Auth-Key in the URL path**: `https://urlhaus-api.abuse.ch/v2/files/exports/<AUTH-KEY>/recent.csv` (per https://urlhaus.abuse.ch/api/). Without a valid key the endpoint refuses the request (`401`/`403`); TrustLens records the error (seen as "HTTP 401" or "Failed to fetch" in testing) and stores no data |
| Getting a key | abuse.ch Authentication Portal (free) |
| Format | CSV with `#` comment lines; column 3 is the URL (`id,dateadded,url,url_status,...`) |
| TrustLens refresh | Every 6 hours (abuse.ch asks for no more than every 5 minutes) |
| Terms | Free under abuse.ch fair-use terms; commercial use may need a subscription (abuse.ch/terms-of-use) |
| Status in TrustLens | Off until you paste a key on the options page. **Not verified with a real key in this build**: the parser follows the documented CSV layout and is unit-tested on a sample in that format |

## Bundled demo feed (always available, offline)

`data/sample-feed.txt`: a few synthetic hosts and URLs under the reserved
`.test` / `.invalid` TLDs (RFC 2606 / 6761), so the warning page and "Known
malicious" verdicts can be demonstrated with no network and no real phishing
site. MIT.

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
