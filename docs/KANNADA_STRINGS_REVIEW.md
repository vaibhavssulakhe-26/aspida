# Kannada interface strings: review sheet (DRAFT)

The Kannada (ಕನ್ನಡ) interface strings in `src/config/strings/kn.js` are a
**DRAFT** machine-assisted translation. They need review by a native speaker
before being relied on. Please check meaning, tone (plain, calm, not alarmist)
and natural word choice, and suggest edits in the "Kannada (draft)" column.

Rules for reviewers:

- Never translate "No known threats found" as "safe" (ಸುರಕ್ಷಿತ); Aspida never
  claims a site is safe. A unit test rejects ಸುರಕ್ಷಿತ.
- Keep `{placeholders}` exactly as they are (a test checks this).
- "Aspida" is the product name and stays in Latin letters. Brand and product
  names (Gmail, WhatsApp Web, UPI, OTP, URLhaus, SPF/DKIM/DMARC, "show details")
  are kept as written.
- Reason sentences produced by the checks (e.g. "Link text shows X but it opens
  Y") are **not** translated in this version and stay in English.

Regenerate this file after changing either table: `node tools/kannada-review.mjs`.
119 strings.

## Verdict tiers

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `tier.none` | No known threats found | ತಿಳಿದಿರುವ ಯಾವುದೇ ಅಪಾಯ ಕಂಡುಬಂದಿಲ್ಲ |
| `tier.suspicious` | Suspicious | ಸಂಶಯಾಸ್ಪದ |
| `tier.high` | High risk | ಹೆಚ್ಚಿನ ಅಪಾಯ |
| `tier.malicious` | Known malicious | ತಿಳಿದಿರುವ ದುರುದ್ದೇಶಪೂರಿತ |

## Tooltip and banner text

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `verdict.noneNote` | No risk signals from local checks or threat feeds. This is not a guarantee: stay careful with passwords, OTPs and payments. | ಸ್ಥಳೀಯ ಪರಿಶೀಲನೆಗಳು ಅಥವಾ ಬೆದರಿಕೆ ಪಟ್ಟಿಗಳಿಂದ ಯಾವುದೇ ಅಪಾಯದ ಸೂಚನೆ ಇಲ್ಲ. ಇದು ಖಾತರಿಯಲ್ಲ: ಪಾಸ್‌ವರ್ಡ್, OTP ಮತ್ತು ಪಾವತಿಗಳ ಬಗ್ಗೆ ಎಚ್ಚರಿಕೆಯಿಂದಿರಿ. |
| `verdict.allowlisted` | On your allowlist: checks skipped. | ನಿಮ್ಮ ಅನುಮತಿ ಪಟ್ಟಿಯಲ್ಲಿದೆ: ಪರಿಶೀಲನೆಗಳನ್ನು ಬಿಡಲಾಗಿದೆ. |
| `verdict.via` | Real destination read from a {via} redirect link (not opened). | ನಿಜವಾದ ಗಮ್ಯಸ್ಥಾನವನ್ನು {via} ಮರುನಿರ್ದೇಶನ ಲಿಂಕ್‌ನಿಂದ ಓದಲಾಗಿದೆ (ತೆರೆಯಲಾಗಿಲ್ಲ). |
| `verdict.more` | +{n} more | +{n} ಇನ್ನಷ್ಟು |
| `verdict.evidenceTitle` | Evidence: the exact text that triggered this | ಸಾಕ್ಷ್ಯ: ಇದನ್ನು ಗುರುತಿಸಿದ ನಿಖರ ಪಠ್ಯ |

## Chat badge

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `badge.title` | Aspida: {label}. {detail} | Aspida: {label}. {detail} |

## Gmail banner

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `banner.title` | Aspida: {label} | Aspida: {label} |
| `banner.checkedOne` | sender + 1 link checked | ಕಳುಹಿಸಿದವರು + 1 ಲಿಂಕ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ |
| `banner.checkedMany` | sender + {n} links checked | ಕಳುಹಿಸಿದವರು + {n} ಲಿಂಕ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ |
| `banner.sender` | Sender {address} | ಕಳುಹಿಸಿದವರು {address} |
| `banner.replyToHidden` | Reply-To isn't shown in Gmail's normal view, so it wasn't checked. Open "show details" on the email to include it. | Gmail ನ ಸಾಮಾನ್ಯ ನೋಟದಲ್ಲಿ Reply-To ತೋರಿಸುವುದಿಲ್ಲ, ಆದ್ದರಿಂದ ಅದನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿಲ್ಲ. ಅದನ್ನು ಸೇರಿಸಲು ಇಮೇಲ್‌ನಲ್ಲಿ "show details" ತೆರೆಯಿರಿ. |
| `banner.noAuthResults` | Gmail does not expose SPF/DKIM/DMARC results to extensions; this check uses the visible sender, links and Reply-To only. | Gmail SPF/DKIM/DMARC ಫಲಿತಾಂಶಗಳನ್ನು ವಿಸ್ತರಣೆಗಳಿಗೆ ನೀಡುವುದಿಲ್ಲ; ಈ ಪರಿಶೀಲನೆ ಕಾಣುವ ಕಳುಹಿಸಿದವರು, ಲಿಂಕ್‌ಗಳು ಮತ್ತು Reply-To ಅನ್ನು ಮಾತ್ರ ಬಳಸುತ್ತದೆ. |

## QR tooltip

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `qr.unreadable` | Could not read this image. | ಈ ಚಿತ್ರವನ್ನು ಓದಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. |
| `qr.notChecked` | QR code not checked | QR ಕೋಡ್ ಪರಿಶೀಲಿಸಲಾಗಿಲ್ಲ |
| `qr.contains` | QR code contains (not opened): | QR ಕೋಡ್‌ನಲ್ಲಿರುವುದು (ತೆರೆಯಲಾಗಿಲ್ಲ): |
| `qr.upiTitle` | UPI payment request | UPI ಪಾವತಿ ವಿನಂತಿ |
| `qr.textTitle` | QR code text | QR ಕೋಡ್ ಪಠ್ಯ |
| `qr.upiPayee` | Pays to UPI ID | ಈ UPI ID ಗೆ ಹಣ ಹೋಗುತ್ತದೆ |
| `qr.upiName` | Payee name in the code | ಕೋಡ್‌ನಲ್ಲಿರುವ ಸ್ವೀಕರಿಸುವವರ ಹೆಸರು |
| `qr.upiAmount` | Amount | ಮೊತ್ತ |
| `qr.notGiven` | (not given) | (ನೀಡಿಲ್ಲ) |
| `qr.maybeLink` | This is not a full web address, but some scanner apps may open {host} as a link. The check below is for that site. | ಇದು ಪೂರ್ಣ ವೆಬ್ ವಿಳಾಸವಲ್ಲ, ಆದರೆ ಕೆಲವು ಸ್ಕ್ಯಾನರ್ ಆ್ಯಪ್‌ಗಳು {host} ಅನ್ನು ಲಿಂಕ್ ಆಗಿ ತೆರೆಯಬಹುದು. ಕೆಳಗಿನ ಪರಿಶೀಲನೆ ಆ ಸೈಟ್‌ಗಾಗಿ. |
| `qr.upiNote` | Scanning this sends money; it never receives money. Check the UPI ID belongs to who you expect: the payee name in a QR code is chosen by whoever made it. | ಇದನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿದರೆ ಹಣ ಕಳುಹಿಸಲಾಗುತ್ತದೆ; ಹಣ ಎಂದಿಗೂ ಬರುವುದಿಲ್ಲ. UPI ID ನೀವು ನಿರೀಕ್ಷಿಸಿದವರದ್ದೇ ಎಂದು ಪರಿಶೀಲಿಸಿ: QR ಕೋಡ್‌ನಲ್ಲಿನ ಹೆಸರನ್ನು ಅದನ್ನು ರಚಿಸಿದವರೇ ಆಯ್ಕೆ ಮಾಡುತ್ತಾರೆ. |

## Advice

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `advice.software.piracy-list` | This site is listed as distributing cracked or pirated software, which commonly comes bundled with malware. Avoid downloading from it. Use the official site or a trusted store. | ಈ ಸೈಟ್ ಕ್ರ್ಯಾಕ್ ಮಾಡಿದ ಅಥವಾ ಪೈರೇಟೆಡ್ ಸಾಫ್ಟ್‌ವೇರ್ ಹಂಚುವ ಪಟ್ಟಿಯಲ್ಲಿದೆ; ಅಂತಹ ಸಾಫ್ಟ್‌ವೇರ್ ಜೊತೆ ಹೆಚ್ಚಾಗಿ ಮಾಲ್‌ವೇರ್ ಸೇರಿರುತ್ತದೆ. ಇಲ್ಲಿಂದ ಡೌನ್‌ಲೋಡ್ ಮಾಡಬೇಡಿ. ಅಧಿಕೃತ ಸೈಟ್ ಅಥವಾ ವಿಶ್ವಾಸಾರ್ಹ ಸ್ಟೋರ್ ಬಳಸಿ. |

## Toolbar icon tooltip

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `toolbar.normal` | Aspida settings | Aspida ಸೆಟ್ಟಿಂಗ್‌ಗಳು |
| `toolbar.none` | Aspida: No known threats found for this site (click for settings) | Aspida: ಈ ಸೈಟ್‌ನಲ್ಲಿ ತಿಳಿದಿರುವ ಯಾವುದೇ ಅಪಾಯ ಕಂಡುಬಂದಿಲ್ಲ (ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ) |
| `toolbar.suspicious` | Aspida: Suspicious signs on this site (click for settings) | Aspida: ಈ ಸೈಟ್‌ನಲ್ಲಿ ಸಂಶಯಾಸ್ಪದ ಸೂಚನೆಗಳಿವೆ (ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ) |
| `toolbar.high` | Aspida: High risk site (click for settings) | Aspida: ಹೆಚ್ಚಿನ ಅಪಾಯದ ಸೈಟ್ (ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ) |
| `toolbar.malicious` | Aspida: Known malicious site (click for settings) | Aspida: ತಿಳಿದಿರುವ ದುರುದ್ದೇಶಪೂರಿತ ಸೈಟ್ (ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ) |

## Warning page

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `warning.pageTitle` | Aspida warning | Aspida ಎಚ್ಚರಿಕೆ |
| `warning.heading` | This page was stopped before it loaded | ಈ ಪುಟ ಲೋಡ್ ಆಗುವ ಮೊದಲೇ ತಡೆಯಲಾಗಿದೆ |
| `warning.headingMalicious` | Known malicious site blocked | ತಿಳಿದಿರುವ ದುರುದ್ದೇಶಪೂರಿತ ಸೈಟ್ ತಡೆಯಲಾಗಿದೆ |
| `warning.headingHigh` | High-risk site stopped | ಹೆಚ್ಚಿನ ಅಪಾಯದ ಸೈಟ್ ತಡೆಯಲಾಗಿದೆ |
| `warning.lede` | Aspida found risk signals for the address below. Nothing from that site has been loaded. | ಕೆಳಗಿನ ವಿಳಾಸಕ್ಕೆ Aspida ಅಪಾಯದ ಸೂಚನೆಗಳನ್ನು ಕಂಡಿದೆ. ಆ ಸೈಟ್‌ನಿಂದ ಏನನ್ನೂ ಲೋಡ್ ಮಾಡಲಾಗಿಲ್ಲ. |
| `warning.address` | Address | ವಿಳಾಸ |
| `warning.missingAddress` | (missing address) | (ವಿಳಾಸ ಇಲ್ಲ) |
| `warning.back` | Go back | ಹಿಂದಕ್ಕೆ ಹೋಗಿ |
| `warning.allow` | Add to allowlist and continue | ಅನುಮತಿ ಪಟ್ಟಿಗೆ ಸೇರಿಸಿ ಮುಂದುವರಿಯಿರಿ |
| `warning.proceed` | Proceed anyway | ಆದರೂ ಮುಂದುವರಿಯಿರಿ |
| `warning.fine` | Proceeding only affects this tab. Aspida never opens or contacts the site for this check; it was matched against local feeds and local rules. | ಮುಂದುವರಿಯುವುದು ಈ ಟ್ಯಾಬ್‌ಗೆ ಮಾತ್ರ ಅನ್ವಯಿಸುತ್ತದೆ. ಈ ಪರಿಶೀಲನೆಗಾಗಿ Aspida ಆ ಸೈಟ್ ಅನ್ನು ಎಂದಿಗೂ ತೆರೆಯುವುದಿಲ್ಲ ಅಥವಾ ಸಂಪರ್ಕಿಸುವುದಿಲ್ಲ; ಸ್ಥಳೀಯ ಪಟ್ಟಿಗಳು ಮತ್ತು ಸ್ಥಳೀಯ ನಿಯಮಗಳೊಂದಿಗೆ ಹೋಲಿಸಲಾಗಿದೆ. |

## Settings page

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `options.pageTitle` | Aspida settings | Aspida ಸೆಟ್ಟಿಂಗ್‌ಗಳು |
| `options.sub` | All checks run on this device. Nothing you browse, read or receive is sent anywhere. | ಎಲ್ಲಾ ಪರಿಶೀಲನೆಗಳು ಈ ಸಾಧನದಲ್ಲೇ ನಡೆಯುತ್ತವೆ. ನೀವು ಬ್ರೌಸ್ ಮಾಡುವ, ಓದುವ ಅಥವಾ ಸ್ವೀಕರಿಸುವ ಯಾವುದನ್ನೂ ಎಲ್ಲಿಗೂ ಕಳುಹಿಸುವುದಿಲ್ಲ. |
| `options.version` | Version {v}. | ಆವೃತ್ತಿ {v}. |
| `options.language` | Interface language | ಇಂಟರ್ಫೇಸ್ ಭಾಷೆ |
| `options.languageHint` | Kannada translation is a draft. Reasons from the checks stay in English. | ಕನ್ನಡ ಅನುವಾದ ಕರಡು ರೂಪದಲ್ಲಿದೆ. ಪರಿಶೀಲನೆಗಳ ಕಾರಣಗಳು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲೇ ಇರುತ್ತವೆ. |
| `options.features` | Features | ವೈಶಿಷ್ಟ್ಯಗಳು |
| `options.featuresHint` | Each feature can be switched off on its own. Changes apply right away, without reloading pages. | ಪ್ರತಿ ವೈಶಿಷ್ಟ್ಯವನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ಆಫ್ ಮಾಡಬಹುದು. ಬದಲಾವಣೆಗಳು ಪುಟಗಳನ್ನು ಮರುಲೋಡ್ ಮಾಡದೆ ತಕ್ಷಣ ಅನ್ವಯಿಸುತ್ತವೆ. |
| `options.feeds` | Threat feeds | ಬೆದರಿಕೆ ಪಟ್ಟಿಗಳು |
| `options.feedsHint` | Feed files are downloaded from the listed hosts and matched locally. Your URLs are never sent to them. | ಪಟ್ಟಿ ಫೈಲ್‌ಗಳನ್ನು ಕೆಳಗಿನ ಹೋಸ್ಟ್‌ಗಳಿಂದ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ ಸ್ಥಳೀಯವಾಗಿ ಹೋಲಿಸಲಾಗುತ್ತದೆ. ನಿಮ್ಮ URL ಗಳನ್ನು ಅವರಿಗೆ ಎಂದಿಗೂ ಕಳುಹಿಸುವುದಿಲ್ಲ. |
| `options.colOn` | On | ಆನ್ |
| `options.colFeed` | Feed | ಪಟ್ಟಿ |
| `options.colStatus` | Status | ಸ್ಥಿತಿ |
| `options.colEntries` | Entries | ನಮೂದುಗಳು |
| `options.urlhausLabel` | URLhaus Auth-Key | URLhaus Auth-Key |
| `options.urlhausPlaceholder` | Free key from auth.abuse.ch | auth.abuse.ch ನಿಂದ ಉಚಿತ ಕೀ |
| `options.saveKey` | Save key | ಕೀ ಉಳಿಸಿ |
| `options.allowlist` | Allowlist | ಅನುಮತಿ ಪಟ್ಟಿ |
| `options.allowHint` | Sites you trust. Aspida skips every check for them, including feeds. | ನೀವು ನಂಬುವ ಸೈಟ್‌ಗಳು. ಅವುಗಳಿಗೆ Aspida ಬೆದರಿಕೆ ಪಟ್ಟಿಗಳೂ ಸೇರಿದಂತೆ ಎಲ್ಲಾ ಪರಿಶೀಲನೆಗಳನ್ನು ಬಿಡುತ್ತದೆ. |
| `options.domain` | Domain | ಡೊಮೇನ್ |
| `options.add` | Add | ಸೇರಿಸಿ |
| `options.empty` | Empty | ಖಾಲಿ |
| `options.remove` | Remove {d} | {d} ತೆಗೆದುಹಾಕಿ |
| `options.stats` | Local counters | ಸ್ಥಳೀಯ ಎಣಿಕೆಗಳು |
| `options.statsHint` | Counts only; no URLs or messages are kept. | ಎಣಿಕೆಗಳು ಮಾತ್ರ; ಯಾವುದೇ URL ಅಥವಾ ಸಂದೇಶಗಳನ್ನು ಇಟ್ಟುಕೊಳ್ಳುವುದಿಲ್ಲ. |
| `options.data` | Your data | ನಿಮ್ಮ ಡೇಟಾ |
| `options.dataHint` | Removes settings, allowlist, counters and downloaded feeds. The bundled demo feed is reloaded. | ಸೆಟ್ಟಿಂಗ್‌ಗಳು, ಅನುಮತಿ ಪಟ್ಟಿ, ಎಣಿಕೆಗಳು ಮತ್ತು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿದ ಪಟ್ಟಿಗಳನ್ನು ಅಳಿಸುತ್ತದೆ. ಜೊತೆಗಿರುವ ಡೆಮೊ ಪಟ್ಟಿಯನ್ನು ಮತ್ತೆ ಲೋಡ್ ಮಾಡಲಾಗುತ್ತದೆ. |
| `options.clear` | Clear all data | ಎಲ್ಲಾ ಡೇಟಾ ಅಳಿಸಿ |
| `options.clearConfirm` | Click again to confirm | ಖಚಿತಪಡಿಸಲು ಮತ್ತೆ ಕ್ಲಿಕ್ ಮಾಡಿ |
| `options.clearing` | Clearing… | ಅಳಿಸಲಾಗುತ್ತಿದೆ… |
| `options.cleared` | All data cleared. | ಎಲ್ಲಾ ಡೇಟಾ ಅಳಿಸಲಾಗಿದೆ. |
| `options.enableFeed` | Enable {name} | {name} ಸಕ್ರಿಯಗೊಳಿಸಿ |
| `options.feedOff` | Off | ಆಫ್ |
| `options.updated` | Updated {ago} | {ago} ನವೀಕರಿಸಲಾಗಿದೆ |
| `options.notDownloaded` | Not downloaded yet | ಇನ್ನೂ ಡೌನ್‌ಲೋಡ್ ಆಗಿಲ್ಲ |
| `options.lastFailed` | Last attempt failed: {error} | ಕೊನೆಯ ಪ್ರಯತ್ನ ವಿಫಲವಾಯಿತು: {error} |
| `options.keepingLast` | (keeping last good copy) | (ಕೊನೆಯ ಸರಿಯಾದ ಪ್ರತಿಯನ್ನು ಇಟ್ಟುಕೊಳ್ಳಲಾಗಿದೆ) |
| `options.refresh` | Refresh | ನವೀಕರಿಸಿ |
| `options.refreshing` | Refreshing… | ನವೀಕರಿಸಲಾಗುತ್ತಿದೆ… |
| `options.entries` | {urls} URLs, {hosts} hosts | {urls} URL ಗಳು, {hosts} ಹೋಸ್ಟ್‌ಗಳು |

## Relative times

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `ago.never` | never | ಎಂದಿಗೂ ಇಲ್ಲ |
| `ago.now` | just now | ಈಗಷ್ಟೇ |
| `ago.minutes` | {n} min ago | {n} ನಿಮಿಷಗಳ ಹಿಂದೆ |
| `ago.hours` | {n} h ago | {n} ಗಂಟೆಗಳ ಹಿಂದೆ |
| `ago.days` | {n} days ago | {n} ದಿನಗಳ ಹಿಂದೆ |

## Local counters

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `stat.suspicious` | Suspicious seen | ಕಂಡ ಸಂಶಯಾಸ್ಪದ |
| `stat.high` | High risk seen | ಕಂಡ ಹೆಚ್ಚಿನ ಅಪಾಯ |
| `stat.malicious` | Known malicious seen | ಕಂಡ ತಿಳಿದಿರುವ ದುರುದ್ದೇಶಪೂರಿತ |
| `stat.blocked` | Navigations stopped | ತಡೆದ ಸಂಚಾರಗಳು |
| `stat.qrDecoded` | QR codes decoded | ಓದಿದ QR ಕೋಡ್‌ಗಳು |

## Feature switches

| Key | English (source) | Kannada (draft) |
|---|---|---|
| `feature.hoverVerdict` | Link hover verdict | ಲಿಂಕ್ ಮೇಲೆ ತೀರ್ಪು |
| `feature.hoverVerdict.desc` | Show a verdict tooltip when you hover a link on any web page. | ಯಾವುದೇ ವೆಬ್ ಪುಟದಲ್ಲಿ ಲಿಂಕ್ ಮೇಲೆ ಮೌಸ್ ಇಟ್ಟಾಗ ತೀರ್ಪಿನ ಟೂಲ್‌ಟಿಪ್ ತೋರಿಸಿ. |
| `feature.qrHover` | QR code hover | QR ಕೋಡ್ ಮೇಲೆ ಪರಿಶೀಲನೆ |
| `feature.qrHover.desc` | Decode QR codes in images on hover and check the link inside, without opening it. | ಮೌಸ್ ಇಟ್ಟಾಗ ಚಿತ್ರಗಳಲ್ಲಿನ QR ಕೋಡ್ ಓದಿ, ಒಳಗಿನ ಲಿಂಕ್ ಅನ್ನು ತೆರೆಯದೆ ಪರಿಶೀಲಿಸಿ. |
| `feature.navigationGuard` | Warning page | ಎಚ್ಚರಿಕೆ ಪುಟ |
| `feature.navigationGuard.desc` | Stop navigations to known-malicious sites (threat-feed matches) with a warning page. | ತಿಳಿದಿರುವ ದುರುದ್ದೇಶಪೂರಿತ ಸೈಟ್‌ಗಳಿಗೆ (ಬೆದರಿಕೆ ಪಟ್ಟಿಯಲ್ಲಿರುವವು) ಹೋಗುವುದನ್ನು ಎಚ್ಚರಿಕೆ ಪುಟದೊಂದಿಗೆ ತಡೆಯಿರಿ. |
| `feature.blockHighRisk` | Warning page for High risk | ಹೆಚ್ಚಿನ ಅಪಾಯಕ್ಕೂ ಎಚ್ಚರಿಕೆ ಪುಟ |
| `feature.blockHighRisk.desc` | Also stop navigations that local checks rate "High risk" (lookalike domains etc.). | ಸ್ಥಳೀಯ ಪರಿಶೀಲನೆಗಳು "ಹೆಚ್ಚಿನ ಅಪಾಯ" ಎಂದು ಗುರುತಿಸಿದ ಸೈಟ್‌ಗಳಿಗೂ (ನಕಲಿ ಹೋಲುವ ಡೊಮೇನ್‌ಗಳು ಇತ್ಯಾದಿ) ಹೋಗುವುದನ್ನು ತಡೆಯಿರಿ. |
| `feature.toolbarIcon` | Toolbar icon reflects the current site | ಟೂಲ್‌ಬಾರ್ ಐಕಾನ್ ಪ್ರಸ್ತುತ ಸೈಟ್ ತೋರಿಸುತ್ತದೆ |
| `feature.toolbarIcon.desc` | Colour the Aspida toolbar icon from a local check of the page you are on: green no known threats found, orange suspicious, red high risk or known malicious. | ನೀವು ಇರುವ ಪುಟದ ಸ್ಥಳೀಯ ಪರಿಶೀಲನೆಯಿಂದ Aspida ಟೂಲ್‌ಬಾರ್ ಐಕಾನ್‌ಗೆ ಬಣ್ಣ: ಹಸಿರು ತಿಳಿದಿರುವ ಅಪಾಯವಿಲ್ಲ, ಕಿತ್ತಳೆ ಸಂಶಯಾಸ್ಪದ, ಕೆಂಪು ಹೆಚ್ಚಿನ ಅಪಾಯ ಅಥವಾ ತಿಳಿದಿರುವ ದುರುದ್ದೇಶಪೂರಿತ. |
| `feature.softwareChecks` | Cracked / pirated software | ಕ್ರ್ಯಾಕ್ / ಪೈರೇಟೆಡ್ ಸಾಫ್ಟ್‌ವೇರ್ |
| `feature.softwareChecks.desc` | Mention in the hover verdict when a site is on a pirated-software list, or a link looks like a cracked download. Tooltip only, never a warning page. | ಸೈಟ್ ಪೈರೇಟೆಡ್ ಸಾಫ್ಟ್‌ವೇರ್ ಪಟ್ಟಿಯಲ್ಲಿದ್ದರೆ ಅಥವಾ ಲಿಂಕ್ ಕ್ರ್ಯಾಕ್ ಡೌನ್‌ಲೋಡ್‌ನಂತೆ ಕಂಡರೆ ತೀರ್ಪಿನಲ್ಲಿ ತಿಳಿಸಿ. ಟೂಲ್‌ಟಿಪ್ ಮಾತ್ರ, ಎಚ್ಚರಿಕೆ ಪುಟವಿಲ್ಲ. |
| `feature.chatWhatsApp` | WhatsApp Web | WhatsApp Web |
| `feature.chatWhatsApp.desc` | Pre-check links in WhatsApp Web chats so the hover verdict is instant. | ಮೌಸ್ ಇಟ್ಟಾಗ ತೀರ್ಪು ತಕ್ಷಣ ಬರುವಂತೆ WhatsApp Web ಚಾಟ್‌ಗಳಲ್ಲಿನ ಲಿಂಕ್‌ಗಳನ್ನು ಮೊದಲೇ ಪರಿಶೀಲಿಸಿ. |
| `feature.chatTelegram` | Telegram Web | Telegram Web |
| `feature.chatTelegram.desc` | Pre-check links in Telegram Web chats so the hover verdict is instant. | ಮೌಸ್ ಇಟ್ಟಾಗ ತೀರ್ಪು ತಕ್ಷಣ ಬರುವಂತೆ Telegram Web ಚಾಟ್‌ಗಳಲ್ಲಿನ ಲಿಂಕ್‌ಗಳನ್ನು ಮೊದಲೇ ಪರಿಶೀಲಿಸಿ. |
| `feature.chatInstagram` | Instagram DMs | Instagram DM ಗಳು |
| `feature.chatInstagram.desc` | Pre-check links in Instagram direct messages so the hover verdict is instant. | ಮೌಸ್ ಇಟ್ಟಾಗ ತೀರ್ಪು ತಕ್ಷಣ ಬರುವಂತೆ Instagram ನೇರ ಸಂದೇಶಗಳಲ್ಲಿನ ಲಿಂಕ್‌ಗಳನ್ನು ಮೊದಲೇ ಪರಿಶೀಲಿಸಿ. |
| `feature.chatInlineBadges` | Show inline badges in chat | ಚಾಟ್‌ನಲ್ಲಿ ಲಿಂಕ್ ಪಕ್ಕ ಬ್ಯಾಡ್ಜ್ ತೋರಿಸಿ |
| `feature.chatInlineBadges.desc` | Also put a small risk badge next to risky links in the chats above, without hovering. Off by default. | ಮೇಲಿನ ಚಾಟ್‌ಗಳಲ್ಲಿ ಅಪಾಯಕಾರಿ ಲಿಂಕ್‌ಗಳ ಪಕ್ಕ, ಮೌಸ್ ಇಡದೆಯೇ, ಸಣ್ಣ ಅಪಾಯದ ಬ್ಯಾಡ್ಜ್ ಇರಿಸಿ. ಡೀಫಾಲ್ಟ್ ಆಗಿ ಆಫ್. |
| `feature.gmailBanner` | Gmail: opened email | Gmail: ತೆರೆದ ಇಮೇಲ್ |
| `feature.gmailBanner.desc` | Show a banner on an opened email with sender and link checks. | ತೆರೆದ ಇಮೇಲ್ ಮೇಲೆ ಕಳುಹಿಸಿದವರು ಮತ್ತು ಲಿಂಕ್ ಪರಿಶೀಲನೆಗಳ ಬ್ಯಾನರ್ ತೋರಿಸಿ. |
| `feature.gmailInboxHighlight` | Gmail: inbox highlighting | Gmail: ಇನ್‌ಬಾಕ್ಸ್ ಹೈಲೈಟ್ |
| `feature.gmailInboxHighlight.desc` | Colour inbox rows yellow/red from the sender name and address shown in the list. Weak signal; off by default. | ಪಟ್ಟಿಯಲ್ಲಿ ಕಾಣುವ ಕಳುಹಿಸಿದವರ ಹೆಸರು ಮತ್ತು ವಿಳಾಸದಿಂದ ಇನ್‌ಬಾಕ್ಸ್ ಸಾಲುಗಳಿಗೆ ಹಳದಿ/ಕೆಂಪು ಬಣ್ಣ. ದುರ್ಬಲ ಸೂಚನೆ; ಡೀಫಾಲ್ಟ್ ಆಗಿ ಆಫ್. |
| `feature.debug` | Debug logging | ಡೀಬಗ್ ಲಾಗಿಂಗ್ |
| `feature.debug.desc` | Log selector mismatches and timing to the page console (console.debug). | ಸೆಲೆಕ್ಟರ್ ಹೊಂದಾಣಿಕೆಯಾಗದಿರುವುದು ಮತ್ತು ಸಮಯವನ್ನು ಪುಟದ ಕನ್ಸೋಲ್‌ಗೆ ದಾಖಲಿಸಿ (console.debug). |
