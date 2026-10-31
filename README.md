# Aspida

A privacy-first Chrome extension (Manifest V3) that tells you whether links,
QR codes, chat messages and opened emails show phishing or social-engineering
risk signals. It explains **why**, with the exact text that triggered each
signal, and it never takes actions on your behalf.

- All analysis runs in your browser. No backend, no telemetry, no per-URL lookups.
- The only network traffic is downloading threat-feed files from three
  allowlisted hosts (and, for QR codes on other sites, re-fetching the image
  you hover). See [PRIVACY.md](PRIVACY.md).
- Verdicts are never "safe". They are **No known threats found**,
  **Suspicious**, **High risk** or **Known malicious**, always with evidence.

Built for a 24-hour defensive-security hackathon (phishing / social engineering /
identity trust track).

## Install (no build step)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.
2. Click the toolbar icon to open settings. Feeds download in the background;
   the bundled demo feed and top-domains list work offline immediately.

Demo pages: `npm run demo` (or `python3 -m http.server -d demo -b 127.0.0.1 8080`),
then open http://localhost:8080/ (the demo mailbox for email checks is
http://localhost:8080/mail.html). If port 8080 is taken (often by an earlier
demo server), use `npm run demo -- 8081`. Stage walkthrough: [DEMO.md](DEMO.md).

## What it does

| Feature | Where | Setting (default) |
|---|---|---|
| Link hover verdict with cited evidence; visible links pre-checked | all http(s) pages | Link hover verdict (on) |
| Typosquat / homoglyph / IDN lookalikes, brand claims (SBI, HDFC, ICICI, Paytm, PhonePe, Google Pay, IRCTC, Amazon, Flipkart, …) | everywhere | part of every check |
| Threat-feed matching (OpenPhish, Phishing.Database), local | everywhere | per feed (on) |
| QR code hover: decode locally, show contents, check the link, never open it; UPI payee shown | all http(s) pages | QR code hover (on) |
| Chat links: background pre-check so the hover verdict is instant | WhatsApp Web, Telegram Web, Instagram DMs | one per app (on) |
| Inline risk badges next to chat links (verdicts are otherwise shown only on hover/focus) | same chat apps | Show inline badges in chat (**off**) |
| Opened-email banner: sender, Reply-To (if visible), links | Gmail | Gmail: opened email (on) |
| Inbox row highlighting from the listed sender (weak signal) | Gmail | Gmail: inbox highlighting (**off**) |
| Warning page before loading known-malicious sites | navigation | Warning page (on), Warning page for High risk (on) |
| Cracked / pirated software: host on a pirated-software list (HaGeZi Anti-Piracy, bundled demo list), 2+ cracked-software words (crack, keygen, activator, …), or a direct .exe/.msi/.zip/.iso/.scr/.apk download from an unknown site. Suspicious at most on its own, tooltip only, never a warning page | all http(s) pages | Cracked / pirated software (on) |
| Toolbar icon colour for the current page: green no known threats found, orange suspicious, red high risk / known malicious, black not checked (non-web pages) | toolbar | Toolbar icon reflects the current site (on) |
| Settings page: title "ASPIDA – Your digital shield" and a circular navbar (About, Features, Threat feeds, Allowlist, Local counter, Your data; About first). Click a section or use ←/→ and it slides to the centre | options page | n/a |
| Settings page theme: light / dark "Clean Blue" palette, sun/moon button top-right | options page | follows the system (`auto`) |
| "Report this link" on warning tooltips and the warning page: shows the exact URL (query/#fragment removed by default), Copy URL, and opens Google Safe Browsing (prefilled), Netcraft or cybercrime.gov.in in a new tab only when clicked; "Report a wrong warning" opens a prefilled GitHub issue or copies the details. Nothing is sent automatically | tooltips (risky tiers only), warning page | Report this link button (on) |
| Interface language: English or Kannada (ಕನ್ನಡ, **DRAFT** translation) for tier names, buttons, settings, warning page, tooltip/banner text and advice. Reason sentences from the checks stay in English | options page, EN / ಕನ್ನಡ switch top-right | English |

Every feature has its own switch so it can be turned off instantly (e.g. on stage)
without reloading the extension.

## Architecture

```
manifest.json
src/
  core/        pure: URL parsing, punycode, registrable domain, redirect unwrapping,
               reference context, feed parsers, QR payload classification, pipeline
  checks/      pure, one module per check, each: check(input, ctx) -> Signal[]
    index.js   the check registry (the extension point)
  scoring/     weights.js (THE weight table + thresholds), score.js, icon-state.js
  config/strings/  en.js, kn.js (interface text, t() with English fallback)
  config/      brands, lists (shorteners, odd TLDs, freemail…), feeds, settings
  background/  service-worker (entry), analyzer, feed-manager, navigation-guard, toolbar-icon, qr-fetch
  content/     loader (classic) -> main (ES module) -> hover-links, qr-hover, chat, gmail
    sites/     ONE selectors file per site (gmail, whatsapp, telegram, instagram, demos)
  ui/          render.js (the single renderer), overlay.js (Shadow DOM), warning/, options/
  platform/    the only files that call chrome.* or IndexedDB
  qr/          decode.js (OffscreenCanvas + jsQR), shared by content and worker
data/          top-domains.txt (Tranco top 10k), sample-feed.txt (synthetic demo feed)
vendor/jsqr/   jsQR 1.4.0, Apache-2.0, unmodified
tests/         node:test unit tests + fixtures
tools/         smoke-test (Chrome for Testing), demo server
demo/          offline demo pages (links, QR, chat mock, Gmail mock, heavy page)
```

**Data flow.** Content scripts only read the DOM and render. They send URLs
(or a sender) to the service worker, which looks up local feed hits in
IndexedDB, runs the pure pipeline, and returns a *verdict*:

```js
{ subject, kind: 'url' | 'sender', host, hostUnicode, registrable, via?,
  tier: 'none' | 'suspicious' | 'high' | 'malicious', label, score,
  reasons: [{ id, category, weight, evidence, detail }], allowlisted }
```

The tooltip, (optional) chat badge, Gmail banner and warning page all render that
same shape with `src/ui/render.js`.

**Signals → verdict.** Checks never decide the verdict. Each returns signals;
`scoring/score.js` sums distinct signal weights from `scoring/weights.js`
(capped at 100): ≥30 Suspicious, ≥70 High risk; any `feed` signal is Known
malicious. On well-known domains (Tranco top 10k + official brand domains)
only exact-URL feed hits and the informational shortener note survive; the
user allowlist suppresses everything.

**Adding a check** (e.g. newly-registered domains, DNS rebinding, SMS, AI-text,
which are out of scope for now):

1. Write `src/checks/my-check.js` exporting `id` and a pure `check(input, ctx)`.
2. Add its signal ids and weights to `src/scoring/weights.js` (a test enforces this).
3. Register it in `src/checks/index.js`.
4. If it needs outside facts (e.g. domain age from RDAP), fetch them in the
   background analyzer next to the feed lookup and pass them in `input`, the
   way `feedHits` is passed today. The check itself stays pure and testable.

**Service-worker lifetime.** No state is kept in globals. Settings, allowlist,
feed status and counters are in `chrome.storage.local`; feed entries are in
IndexedDB; bypasses and locks are in `chrome.storage.session`. The analyzer
memoises the parsed top-domains list per worker lifetime, but only as a
rebuildable read-only cache. Feed refresh uses `chrome.alarms` (hourly wake;
OpenPhish every 6 h, Phishing.Database every 24 h).

**Feed storage.** IndexedDB keys are `[source, generation, kind, value]`. A
refresh writes a new generation, flips the active generation, then deletes
the old one with a single key-range delete. If a download fails or the worker
dies mid-import, the last good copy stays active and the options page shows
the error. Phishing.Database (~392k domains) imports in about 9 s; a lookup
takes about 2–3 ms including messaging.

**Content scripts as modules.** MV3 content scripts can't be ES modules, so
`src/content/loader.js` (classic) dynamically imports `src/content/main.js` from
the extension package. Those files are listed in `web_accessible_resources`.

## Permissions and why

| Permission | Why | Install warning |
|---|---|---|
| `storage` | Settings, allowlist, counters, feed status | none |
| `unlimitedStorage` | ~400k feed entries in IndexedDB must not be evicted | none |
| `alarms` | Scheduled feed refresh while the worker sleeps | none |
| `webNavigation` | `onBeforeNavigate` to show the warning page (blocking webRequest isn't available in MV3); `onCommitted` / `onHistoryStateUpdated` and `getFrame` to colour the toolbar icon from the current page's URL (which is how the icon works without the `tabs` permission) | "Read your browsing history" |
| host `https://raw.githubusercontent.com/*` | OpenPhish (redirect target), Phishing.Database and HaGeZi Anti-Piracy list files. Chrome ignores paths in host permissions, so it can't be narrowed to the two repos | covered below |
| host `https://openphish.com/*` | OpenPhish feed URL | |
| content scripts on `http://*/*`, `https://*/*` | Link hover and QR hover everywhere, plus the chat and Gmail modules (which only activate on their sites). Chrome also treats these match patterns as host access for the extension's own requests; Aspida uses that only to fetch the bytes of a QR **image** you hover on another site | "Read and change all your data on all websites" |

Setting a tab's toolbar icon and tooltip (`chrome.action.setIcon` / `setTitle`)
needs no permission, and neither does opening a reporting site in a new tab
(`chrome.tabs.create`, only when you click a destination under "Report this link").

There is no `tabs`, `scripting`, `cookies`, `webRequest` or `<all_urls>` permission,
and no remote code: the extension-page CSP is `script-src 'self'`.

## Limitations (honest)

- **Gmail's DOM** exposes the sender's display name and address and the body
  links. It does **not** expose Reply-To unless you open "show details" (we
  never click it), and it never exposes SPF/DKIM/DMARC results. The banner says
  so. Inbox highlighting only sees the listed sender name/address, so it is a
  weak signal and is off by default.
- **Site selectors are not verified against live, logged-in sessions.** Gmail,
  WhatsApp, Telegram and Instagram selectors were written from those apps'
  known DOM structure and checked only on offline mocks (`demo/`), plus a
  logged-out load of each real site to confirm nothing breaks. If tooltips,
  badges or banners don't appear, turn on *Debug logging* and update
  `src/content/sites/<site>.selectors.js`. Everything fails soft.
- **Warning page timing.** `onBeforeNavigate` races the navigation; on a very
  fast connection a page may begin loading before the redirect to the warning
  page lands. Blocking webRequest, which would avoid this, is not available to
  MV3 extensions.
- **Toolbar icon.** It reflects the page's address only (the same local checks
  as a link; the page content isn't read). Chrome clears tab icons on every
  page load, so Aspida sets one on each commit; on a slow first check after
  the browser starts, the default icon may show for a moment. A page shown
  from a prerender, and very fast back-to-back navigations, can briefly keep
  the previous page's colour until the next navigation.
- **Pirated-software list is broad.** HaGeZi Anti-Piracy lists piracy sites in
  general (streaming, games, file hosts), not only cracked software, so the
  tooltip's "cracked or pirated software" wording can be broader than a given
  site deserves; the evidence names the list. Popular piracy sites in the top
  10k are never flagged (see FEEDS.md).
- **"Report this link" in tooltips is mouse-first.** The tooltip floats over the
  page, so keyboard focus can't move into it from a link; the report button there
  is reached with the pointer. The warning page's report step is fully keyboard
  operable, and once the tooltip's report step is open, Tab moves through it.
- **Kannada interface is a DRAFT.** The Kannada strings
  (`src/config/strings/kn.js`) are a machine-assisted draft awaiting review by a
  native speaker ([docs/KANNADA_STRINGS_REVIEW.md](docs/KANNADA_STRINGS_REVIEW.md)).
  Only the interface is translated: the reason sentences produced by the checks
  (e.g. "Link text shows X but it opens Y") stay in English, and detection
  itself is English/Latin-script only. Kannada text uses locally installed
  fonts (Noto Sans Kannada, Nirmala UI, Tunga); no web fonts are loaded.
- **First minute after install.** While Phishing.Database (~392k hosts) is being
  written to IndexedDB, a hover that lands during the bulk write can take a few
  seconds (up to ~5 s measured) to show its tooltip. Afterwards lookups take a
  few milliseconds. Load the extension a minute before a demo.
- **Extension fingerprinting.** Because content modules are web-accessible, a
  page can detect that Aspida is installed by probing a known file path.
  `use_dynamic_url` would prevent this but breaks the modules' relative imports
  in current Chrome, so it is off.
- **Heuristics have false positives.** There are none on the Tranco top 10k (a
  unit test sweeps all of them). On Tranco ranks 10,001–60,000, 0.37% are
  Suspicious and 0.02% High risk, mostly legitimate near-neighbours of popular
  names. Use the allowlist.
- **Registrable domains** use a compact suffix list (common ccTLD second levels
  plus shared-hosting platforms such as `vercel.app`), not the full Public
  Suffix List.
- **Shorteners** are reported but never expanded; expanding would send the link
  to the shortener.
- **Feeds**: OpenPhish Community is for non-commercial use.

## Tests

```sh
npm test                                   # 55 unit tests, Node 22+, no dependencies
npx @puppeteer/browsers install chrome@stable   # once
CHROME_PATH=/path/to/chrome-for-testing npm i && npm run smoke
```

`npm run smoke` loads the unpacked extension in Chrome for Testing and drives
every feature on the demo pages: feeds, warning page, hover, QR (in-page and
service-worker paths), chat hover and opt-in chat badges, Gmail banner and inbox highlighting, live
setting toggles, and feed-failure handling. It fails on any extension error,
service-worker exception, page console error, or **any network request to a
link or QR target that was only hovered or scanned** (a privacy audit). Manual
checks are in [REGRESSION.md](REGRESSION.md).

## Credits and licences

- Tranco list (Le Pochat et al., NDSS 2019), list ID PYK6J: `data/top-domains.txt`
- jsQR 1.4.0 by Cosmo Wolfe, Apache-2.0: `vendor/jsqr/`
- Feeds: see [FEEDS.md](FEEDS.md)
- Aspida itself: MIT ([LICENSE](LICENSE))
