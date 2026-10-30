# Demo script (about 5 minutes)

Everything below works **offline**. Every sample link and QR code in `demo/` points
at the reserved `.test` / `.invalid` / `.example` names (or documentation-only IPs),
so clicking one can never reach a real site, even when its text names a real bank.
The only links to real websites are labelled **Real site (control)**
(`data-control="real"`) and grouped at the end of each page. `tests/demo.test.js`
fails if a sample link ever points at a real domain.

## Setup (before going on stage)

1. `chrome://extensions` → Developer mode → **Load unpacked** → repo folder.
2. `npm run demo` (or `python3 -m http.server -d demo -b 127.0.0.1 8080`). If it
   says the port is in use, stop the old server or run `npm run demo -- 8081`.
3. Open http://localhost:8080/ (or http://127.0.0.1:8080/) and the Aspida settings (toolbar icon) in a second tab.
4. Optional: in settings, turn on **Gmail: inbox highlighting** for step 6.

Kill switches: every feature is a checkbox in settings and applies instantly. If
anything misbehaves, untick it.

## 1. Hover verdicts (demo/index.html)

- In the **Real sites (control)** section at the bottom, hover
  **Real site (control): onlinesbi.sbi** → "No known threats found". It never says
  "safe", and it adds a reminder to stay careful.
- Hover **paypa1.test** → **High risk**: *"paypa1.test" is visually similar to
  "paypal.com"*, citing `paypa1.test`.
- Hover **аррӏе.test** → **High risk**: Cyrillic look-alike of apple.com, showing the
  real punycode `xn--80ak6aa92e.test`.
- Hover **SBI KYC update** (opens `https://sbi-kyc-update.test/update`) →
  **Suspicious**: *"sbi-kyc-update.test" claims to be SBI but the domain is not
  sbi.co.in*.
- Hover the link whose text is `www.icicibank.com` (opens
  `https://account-update.test/session`) → *Link text shows icicibank.com but it
  opens account-update.test*. Clicking it ends on Chrome's "site can't be reached"
  page: `.test` never resolves.
- Hover `https://www.google.com@192.0.2.10/login` → the "@" trick is explained.

Talking point: every line cites the exact fragment that triggered it.
Weights live in one file (`src/scoring/weights.js`).

## 2. Warning page

- Click **malicious.aspida-demo.invalid/login** → interstitial, **Known malicious**,
  evidence "listed by Bundled demo feed".
- Show **Go back**, **Add to allowlist and continue**, **Proceed anyway**. The page
  was stopped before anything loaded.
- Click **paypa1.test** → also stopped (High risk tier; this can be switched off).

## 3. QR codes (demo/qr.html)

- Hover the first QR → *QR code contains (not opened): https://paypa1.test/…* →
  **High risk**. The tab never navigates.
- Hover the **UPI** QR → payee `sbi.refund.desk@okaxis` and amount ₹4999, with the
  note "Scanning this sends money; it never receives money".
- The canvas and cross-origin QR codes decode too (the cross-origin one is
  decoded by the service worker from the image bytes).

## 4. Chats (demo/chat-mock.html)

- Badges appear only next to the risky links (Jio recharge scam, SBI YONO, feed
  match). The real-site control messages after the "Real sites (control)" divider
  (cybercrime.gov.in, Google Photos) get none.
- Click **Simulate a new incoming message** → the new Amazon-lookalike link gets a
  badge within half a second (MutationObserver).
- Same code runs on WhatsApp Web / Telegram Web / Instagram DMs, with site
  selectors in `src/content/sites/`.

## 5. Gmail (demo/gmail-mock.html)

- The KYC email's banner says **Known malicious**, citing: name claims HDFC Bank
  but the domain is `hdfcbank-alerts.test`; Reply-To goes to gmail.com; the link
  text shows hdfcbank.com but opens hdfcbank-kyc.test; one link is feed-listed.
- The colleague's email: "No known threats found".
- Honesty point: the banner states what Gmail's DOM doesn't expose (SPF/DKIM/DMARC,
  and Reply-To unless "show details" is open).

## 6. Inbox highlighting (opt-in)

- With the setting on: PayPal-lookalike sender row red, "SBI Alerts" from a
  gmail.com address yellow, real senders untouched. Untick → colours removed.

## 7. Settings page

- Feed table: OpenPhish (~300 URLs) and Phishing.Database (~392k domains) with
  last-updated times. URLhaus needs an abuse.ch key.
- Allowlist, local counters (numbers only), **Clear all data**.
- Privacy: no backend, no per-URL lookups, `chrome.storage.local` only.

## If the network is down on stage

Nothing changes except the remote feed rows: they show the last good copy (or
"Not downloaded yet"). The bundled demo feed, the top-10k reference list and
every heuristic are packaged with the extension.
