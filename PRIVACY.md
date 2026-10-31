# Privacy

Aspida is designed so that **nothing you browse, read or receive leaves your
device**.

## What is analysed, and where

Link URLs, link text, QR-code contents, chat links, the sender, Reply-To and
links of an opened Gmail message, and (for the toolbar icon colour) the address
of the page open in each tab are analysed **inside your browser**, by the
extension's service worker, against lists stored on your device. The page
address is not stored or logged; only the tab's icon and tooltip are set.

Aspida does **not**:

- send any URL, message, email, sender or QR content to any server (no Safe
  Browsing Lookup API, no per-URL API, no backend, no analytics, no telemetry,
  no remote logging);
- open, prefetch, `HEAD`/`GET`, or follow the target of any link or decoded QR
  code, expand shorteners, or resolve redirects (tracking wrappers such as
  `l.instagram.com/?u=` are read as text);
- click, reply, send, or modify your messages or emails. Content scripts only
  read the page and add Shadow-DOM overlays. When enabled, Gmail inbox
  highlighting sets two inline styles on list rows and restores them when
  turned off.

The smoke test (`npm run smoke`) enforces the "never contacts a link target"
rule. It records every network request from pages and the service worker and
fails if any request goes to a hovered or scanned target.

## Network requests Aspida makes

1. **Feed downloads**, to exactly these hosts (also the only `host_permissions`):
   `raw.githubusercontent.com` and `openphish.com`. The pirated-software list (HaGeZi Anti-Piracy) also comes
   from `raw.githubusercontent.com`. These requests are sent without cookies or a referrer. Like any
   download, they reveal your IP address and the time to that host. They contain
   nothing about your browsing.
2. **QR image bytes**, only when you hover an image hosted on a different site
   than the page. The image is re-fetched without cookies or a referrer, so it
   can be decoded locally. The page has already loaded that same image. The
   decoded link itself is never requested.

## "Report this link"

Warning tooltips (Suspicious, High risk, Known malicious) and the warning page
have a **Report this link** button. It sends **nothing** by itself: there is no
automatic reporting, no backend and no API key. Clicking it only shows the URL
that would be reported (query string and `#fragment` removed by default, since
they can contain personal tokens; user name and password always removed). The
URL leaves your browser only if **you** then:

- click a reporting site (Google Safe Browsing, Netcraft, cybercrime.gov.in), which
  opens that site in a new tab; for Safe Browsing the URL is placed in the new
  tab's address so its form is prefilled, and the other sites get nothing until
  you paste the URL into their form and submit it there; or
- click **Copy URL** / **Copy details**, which only puts text on your clipboard; or
- click **Open a GitHub issue** (report a wrong warning), which opens a new-issue
  page with the URL, verdict tier and signal ids prefilled, for you to submit or
  discard.

In an opened email (Gmail and the demo mailbox) the same rules apply to:

- **Report sender** (Suspicious / High risk senders): shows the sender address and
  display name. **Copy address** only copies it; a reporting-site button copies
  the address and opens that site's plain form in a new tab. Nothing about the
  email is put in the new tab's address.
- the small **Report** button after each flagged link in the email body: the same
  confirm step as the tooltip (URL shown, query/#fragment removed by default).

The extension makes no network request for any of this; opening a tab needs no
extra permission. All report buttons can be turned off in settings ("Report buttons").

## What is stored (on this device only)

| Data | Where | Cleared by |
|---|---|---|
| Settings (including interface language and settings-page theme), allowlist | `chrome.storage.local` (not `sync`, so nothing goes to your Google account) | Clear all data |
| Copy of the settings-page theme (`light` / `dark`), so the page opens in the right colours before settings load | `localStorage` of the extension's own settings page | Clear all data (theme back to `auto`) |
| Feed entries | IndexedDB (extension origin) | Clear all data |
| Feed status (time, counts, last error) | `chrome.storage.local` | Clear all data |
| Detection counters (numbers only, no URLs) | `chrome.storage.local` | Clear all data |
| "Already counted" set: truncated SHA-256 hashes, so the same link isn't counted twice | `chrome.storage.session` (gone when the browser closes) | Clear all data / browser exit |
| "Proceed anyway" bypasses (per tab, registrable domain) | `chrome.storage.session` | closing the tab / browser exit |
| Minimized email banners: a hashed key per email (from Gmail's message id, or sender + subject); no address or subject is stored | `chrome.storage.session` | expanding the banner / browser exit |
| Per-page verdict cache | content-script memory | leaving the page |

**Clear all data** (options page, click twice) deletes all of the above and
then reloads the bundled demo feed.

Earlier versions had an optional URLhaus feed with a personal abuse.ch
Auth-Key. That feed is gone; updating deletes the stored key, the URLhaus
switch and any URLhaus entries.

## Visible to websites

A web page can detect that Aspida is installed by probing one of its
web-accessible module files (see README, Limitations). Pages cannot read
Aspida's tooltips, badges or banners, which live in closed Shadow DOM roots,
and Aspida never injects anything into the page's own JavaScript world.
