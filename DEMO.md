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

### Cracked / pirated software (same page, section "Cracked / pirated software")

| Link | Tooltip |
|---|---|
| `crackzone-downloads.test` | **Suspicious**: "Listed in the pirated-software category (source: Bundled pirated-software demo list)", plus "This site is listed as distributing cracked or pirated software, which commonly comes bundled with malware. Avoid downloading from it. Use the official site or a trusted store." |
| "Adobe Photoshop 2026 crack + keygen (.exe)" | **Suspicious** (listed + keywords + .exe): the category never reaches High risk by itself |
| "Photoshop crack keygen download" (`softvault-mirror.test`, not listed) | **Suspicious**: words "crack, keygen" + direct .exe download |
| "Office 2026 activator" | No known threats found (one word isn't enough) |
| "setup.exe from an unknown site" | No known threats found; the .exe download is listed as a weak sign |
| "How to crack the interview" | No known threats found |

Clicking `crackzone-downloads.test` is **not** stopped by the warning page (DNS
error for `.test` is expected). Turn off "Cracked / pirated software" and the
reasons disappear without reloading.

## 2. Warning page

- Click **malicious.aspida-demo.invalid/login** → interstitial, **Known malicious**,
  evidence "listed by Bundled demo feed".
- Show **Go back**, **Add to allowlist and continue**, **Proceed anyway**. The page
  was stopped before anything loaded.
- Click **paypa1.test** → also stopped (High risk tier; this can be switched off).

### Report this link

- Hover **Claim your UPI cashback** (Known malicious) → the tooltip has **Report
  this link** at the top right. Move onto it and click: the report step shows
  `https://upi-reward.aspida-demo.invalid/claim` (the `?id=4921` query is removed;
  untick the box to include it). **Copy URL** copies it.
- **Google Safe Browsing** opens its report form in a new tab with the URL already
  filled in. **Netcraft** and **cybercrime.gov.in** copy the URL first ("URL copied,
  paste it into the form") and open the plain page. The 1930 helpline line is for
  people who already lost money. Don't submit the demo URL on the real sites.
- **Report a wrong warning**: **Open a GitHub issue** (prefilled with URL, tier and
  signal ids) or **Copy details**. **Close** / Escape closes the step.
- "No known threats found" tooltips never show the button. The warning page has the
  same button below the verdict. Nothing is sent unless you submit a form yourself.

## 3. QR codes (demo/qr.html)

- Hover the first QR → *QR code contains (not opened): https://paypa1.test/…* →
  **High risk**. The tab never navigates.
- Hover the **UPI** QR → payee `sbi.refund.desk@okaxis` and amount ₹4999, with the
  note "Scanning this sends money; it never receives money".
- Hover the **bare domain** QR (encodes `paypa1.test/login`, no `https://`) →
  shown exactly as `paypa1.test/login`, **High risk** (lookalike of paypal.com).
  Phone scanner apps open bare domains as websites, so Aspida checks them as
  `https://…` without opening them.
- Hover the **text with a domain** QR (`Refund desk: sbi-kyc-update.test/claim`) →
  the text, a neutral note "some scanner apps may open sbi-kyc-update.test as a
  link", and **Suspicious** for that site. File names such as `notes.txt` or
  `setup.exe` are never treated as domains (those suffixes are not TLDs).
- The canvas and cross-origin QR codes decode too (the cross-origin one is
  decoded by the service worker from the image bytes).

## 4. Chats (demo/chat-mock.html)

- Nothing is drawn next to the links. Hover the Jio, SBI YONO or electricity-bill
  link → the tooltip shows Suspicious / Known malicious with evidence, instantly
  (chat links are pre-checked in the background). The real-site control messages
  after the "Real sites (control)" divider (cybercrime.gov.in, Google Photos) say
  "No known threats found".
- Optional: turn on **Show inline badges in chat** in settings → small badges appear
  next to the three risky links only. Click **Simulate a new incoming message** →
  the new Amazon-lookalike link gets a badge within half a second
  (MutationObserver). Turn the setting off again → badges removed.
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

## 6b. Demo mailbox (demo/mail.html)

**Aspmail**, a plain white webmail page of our own: the "Aspmail" wordmark with an
**"Aspida demo, not real mail"** label, a search bar (does nothing), a sidebar
(Compose, Inbox, Starred, Sent, Drafts; static) and an inbox list with checkbox,
sender, subject + snippet and time (unread rows bold). No Google or Gmail logo or
branding, no sign-in form, synthetic emails on reserved domains only. It keeps the
DOM structure Gmail uses (`tr.zA` rows, `span.yP[email][name]`, `div.adn`,
`h3.iw span.gD[email]`, `table.ajC`, `div.a3s`), so the real Gmail module runs on
it unchanged.

1. Click an email (or open `mail.html#kyc` etc. directly): the list is replaced by
   the email with Aspida's banner above the body. **← Back to Inbox** returns.
2. Inbox colours: open Aspida settings and turn on **Gmail: inbox highlighting**
   (off by default; the page shows this hint too). Without reloading, the KYC and
   OTP rows get a red left bar and pink tint, the parcel row a yellow bar and tint;
   the three genuine rows stay white. Right after installing, the first colouring can
   take a few seconds while feeds import.

| Email | Banner | Reasons cited | Inbox row (highlighting on) |
|---|---|---|---|
| `#kyc` "Final notice: complete KYC" from "SBI Alerts <alerts@onlinesbi.sbi>" `kyc-alerts@secure-notice.test` | **High risk** | name claims SBI but domain is secure-notice.test; name shows alerts@onlinesbi.sbi but mail is from kyc-alerts@secure-notice.test; replies go to gmail.com; link `onlinesbi-kyc.test` claims SBI; link text shows onlinesbi.sbi but opens onlinesbi-kyc.test; "verify" in the link | red |
| `#parcel` "Parcel on hold: customs fee" from "India Post" `delivery@indiapost-parcel.test` | **Suspicious** | name claims India Post but domain is indiapost-parcel.test; link text shows bit.ly but opens ip-customs.test | yellow |
| `#otp` "Payment of ₹9,999 pending: verify with OTP" from "Paytm Payments" `otp-verify@paytrn.test` | **High risk** | sender domain paytrn.test imitates paytm.com; name claims Paytm; link paytrn.test visually similar to paytm.com, claims Paytm, "verify" | red |
| `#meeting` colleague's meeting notes (`northwind.example`) | No known threats found | none | unchanged |
| `#newsletter` "The Weekly Byte" (`weeklybyte.example`) | No known threats found | none | unchanged |
| `#order` "Your order CW-20417 has shipped" (`cartwheel.example`) | No known threats found | none | unchanged |

Notes: the KYC email shows its Reply-To as if "show details" were open, so the
Reply-To check is demonstrated; the others say Reply-To wasn't visible. The
parcel lure's link *text* looks like a bit.ly short link while its destination is
a reserved `.test` name; the separate "known shortener" signal only fires for
real shortener domains, which the demo never links to. Urgent wording ("within
24 hours") is part of the story only: Aspida doesn't score message text.

## 7. Toolbar icon (demo/toolbar.html)

Pin Aspida first (puzzle-piece menu → pin). Open http://localhost:8080/toolbar.html
and follow its links in the same tab. The `*.localhost` names are answered by the
same local demo server (Chrome resolves every `*.localhost` name to this machine),
so this works offline.

| Page | Icon | Toolbar tooltip |
|---|---|---|
| `localhost:8080/toolbar.html` | green | "Aspida: No known threats found for this site" |
| `amazon-deals.localhost:8080/toolbar.html` | orange | "Aspida: Suspicious signs on this site" |
| `paypa1.localhost:8080/toolbar.html` | warning page first (normal icon on it); after "Proceed anyway": red | "Aspida: High risk site" |
| new tab, settings page, `chrome://` pages | normal (black) | "Aspida settings" |

Turn off "Toolbar icon reflects the current site" and every tab goes back to
the normal icon straight away; turn it on and the icons come back.

## 8. Settings page

Click the Aspida toolbar icon (or open the extension's options).

- Top: **ASPIDA**, "Your digital shield", and a navbar with About, Features,
  Threat feeds, Allowlist, Local counter, Your data. **About** opens first, in
  the centre. Click **Features**: it slides to the centre (bigger, filled) and the
  card below fades to the feature switches. Keep clicking to the right: the bar
  loops (Your data → About → …), always with sections on both sides. ←/→ keys
  do the same once a tab has focus. On a phone-width window only one neighbour
  shows each side.
- Theme: the sun/moon button top-right switches light ↔ dark and is remembered.
  Default follows the system setting.
- Language: click **ಕನ್ನಡ** top-right. The settings page switches at once;
  hover a link on the demo page or open the demo mailbox: tier names, banner text
  and advice are in Kannada, the reasons stay in English (by design). The
  toolbar tooltip and warning page follow too. Click **EN** to switch back.
  (Kannada strings are a DRAFT pending native-speaker review.)
- Threat feeds: OpenPhish (~300 URLs) and Phishing.Database (~392k domains) with
  last-updated times, plus the bundled demo lists and HaGeZi Anti-Piracy.
- Allowlist; Local counter (numbers only); Your data: what is stored on this
  device and **Clear all data**.
- Privacy: no backend, no per-URL lookups, `chrome.storage.local` only.

## If the network is down on stage

Nothing changes except the remote feed rows: they show the last good copy (or
"Not downloaded yet"). The bundled demo feed, the top-10k reference list and
every heuristic are packaged with the extension.
