# Regression checklist

Run before starting and after finishing every milestone. A milestone is done
only when every box below is green.

## Automated

- [ ] `npm test`: all unit tests pass (includes the top-10k false-positive sweep).
- [ ] `CHROME_PATH=<chrome-for-testing> npm run smoke`: extension loads in
      Chrome for Testing with no manifest errors, install warnings, runtime
      errors, service-worker exceptions or console errors; every step in
      `tools/smoke-steps/` passes; the privacy audit reports 0 unexpected
      network requests.

## Manual (Chrome, chrome://extensions → Load unpacked → repo root)

- [ ] m1: Extension card shows no "Errors" button. Service worker "Inspect" console is clean.
- [ ] m2: Options page layout: on a wide window Features is the left column and
      Threat feeds the right; Allowlist, counters and "Clear all data" follow below
      at full width. On a narrow window everything is one column. Tab starts in
      Features. Check light and dark mode.
- [ ] m2: Toolbar icon opens the options page. Feed table shows "Bundled demo feed"
      updated, OpenPhish / Phishing.Database updated within a minute (online), URLhaus
      "Auth-Key not set" unless a key is saved.
- [ ] m2: Visit `http://malicious.aspida-demo.invalid/` → warning page, label
      "Known malicious", evidence cites the host. "Go back" returns; "Proceed anyway"
      leaves the page (DNS error is expected for .invalid) and does not loop.
- [ ] m2: "Add to allowlist and continue" adds `aspida-demo.invalid` to the
      allowlist on the options page; remove it with ×.
- [ ] m2: Turn off "Warning page" → the same URL is no longer intercepted.
- [ ] m2: "Clear all data" (click twice) empties allowlist and counters; demo feed reloads.
- [ ] m3: Serve the demo (`npm run demo` or `python3 -m http.server -d demo -b 127.0.0.1 8080`)
      and open http://localhost:8080/. On Linux also open the chat and Gmail
      demos via http://0.0.0.0:8080/ (the link plain `python3 -m http.server`
      prints) and, with `npm run demo`, http://[::1]:8080/: chat hover
      tooltips and Gmail banners must still appear. Hover each link: tooltip shows tier + cited
      evidence; the "Real site (control)" links (grouped at the bottom) say
      "No known threats found" (never "safe"). No tag, label or badge is ever
      shown next to a link without hovering or focusing it.
- [ ] m3: `www.icicibank.com` link → tooltip "Link text shows icicibank.com but it
      opens account-update.test"; "SBI KYC update" → "claims to be SBI but the
      domain is not sbi.co.in". Clicking either never reaches a real site (DNS
      error page for `.test`). Only "Real site (control)" links open real sites.
- [ ] m3: Tooltip disappears on mouse-out, Escape and scroll; keyboard Tab focus shows it.
- [ ] m3: Tooltip fades and lifts in (about 140 ms) and fades out (about 90 ms), with no
      jump in position. Moving quickly from link to link does not flicker. With the OS
      "reduce motion" setting on (or DevTools → Rendering → prefers-reduced-motion:
      reduce) it only fades, without moving.
- [ ] m3: Report this link: hovering a Suspicious / High risk / Known malicious link shows
      "Report this link"; clean links never do. Moving the pointer onto the button keeps
      the tooltip; moving down past the tooltip to the next link still shows that link's
      tooltip. The report step shows the URL with query/#fragment removed (untick → full
      URL); Copy URL works; Safe Browsing opens prefilled in a new tab; Netcraft and
      cybercrime.gov.in copy the URL ("paste it into the form") and open in a new tab;
      Open a GitHub issue / Copy details work; Close and Escape close it. DevTools
      Network (extension service worker) shows no request when clicking any of these.
      Warning page: same button and step. Setting "Report this link button" off →
      no button, without reload.
- [ ] m3: Turn off "Link hover verdict" in options → tooltips stop without reload.
- [ ] m3: http://localhost:8080/heavy.html scrolls smoothly; a link near the bottom shows a tooltip.
      DevTools Performance recording while scrolling and hovering shows no long tasks
      from the extension and no layout or paint caused by the tooltip fade.
- [ ] m3: Normal sites (e.g. github.com, wikipedia.org) behave normally; links unchanged.
- [ ] m4: http://localhost:8080/qr.html: hover each QR → tooltip shows "QR code contains
      (not opened)", the decoded text, and the verdict (High risk / Known malicious /
      Suspicious / No known threats found). UPI code shows payee + amount note.
- [ ] m4: Bare-domain QR (`paypa1.test/login`) → shown without a scheme, High risk.
      "Text with a domain" QR → note that scanner apps may open sbi-kyc-update.test as a
      link, plus Suspicious. Neither is ever opened or requested (smoke privacy audit).
- [ ] m4: Canvas QR and the cross-origin QR (other loopback host name) both decode.
- [ ] m4: Hovering ordinary photos shows nothing. The tab never navigates to a decoded URL.
- [ ] m4: Turn off "QR code hover" → no QR tooltips.
- [ ] m5: http://localhost:8080/chat-mock.html: no badges by default. Hovering the
      Jio, SBI and malicious links shows the tooltip with the tier; the control links
      say "No known threats found".
- [ ] m5: Turn on "Show inline badges in chat" → badges appear (without reload) after
      the Jio, SBI and malicious links only; "Simulate a new incoming message" adds a
      badge to the new Amazon-lookalike link. Turn it off → badges disappear.
- [ ] m5: With inline badges on, turn off "WhatsApp Web" → badges disappear without reload.
- [ ] m5 (needs accounts, not automated): open a chat with a link on WhatsApp Web,
      Telegram Web (/k/ and /a/) and an Instagram DM. Hovering a risky link shows the
      tooltip (with inline badges on, it also gets a badge). If not,
      enable "Debug logging" and look for "no message container matched" in the
      console, then update `src/content/sites/<site>.selectors.js`.
- [ ] m5: Sending, replying and scrolling in those apps work normally.
- [ ] m6: http://localhost:8080/gmail-mock.html: phishing email banner says "Known
      malicious" and cites Reply-To → gmail.com, "claims to be HDFC Bank", the link
      text mismatch and the feed-listed link; the colleague's email says "No known
      threats found". Both mention what Gmail doesn't expose.
- [ ] m6: Inbox rows are NOT coloured by default. Turn on "Gmail: inbox highlighting":
      PayPal-lookalike row red, SBI-on-gmail.com row yellow, others unchanged. Turn it
      off: colours removed.
- [ ] m6: http://localhost:8080/mail.html ("Aspmail"): header says "Aspida demo, not real
      mail", tab title "Aspmail: Aspida demo mailbox, not real mail"; the highlighting hint
      is shown; no Google branding or sign-in form. Opening an email replaces the list;
      "← Back to Inbox" returns. No banner until an email is opened. Open each email: KYC and OTP →
      High risk, parcel → Suspicious, meeting / newsletter / order → "No known threats
      found", with the reasons listed in DEMO.md §6b. With inbox highlighting on: KYC and
      OTP rows red, parcel yellow, the rest unchanged; off → colours removed.
      gmail-mock.html still works as above.
- [ ] m6 (needs an account, not automated): open a real email in Gmail; banner appears
      above the body; replying, archiving and switching emails work normally. If no
      banner, enable "Debug logging" and update `src/content/sites/gmail.selectors.js`.
- [ ] m8: Pin Aspida. http://localhost:8080/toolbar.html: icon green, toolbar tooltip
      "Aspida: No known threats found for this site" (never "safe"). amazon-deals.localhost
      link → orange "Suspicious signs". paypa1.localhost link → warning page (normal icon)
      → "Proceed anyway" → red "High risk site". Back button → icon follows the page.
- [ ] m8: New tab page and the settings page show the normal (black) icon. Icons look
      sharp at normal and HiDPI zoom, in light and dark toolbars.
- [ ] m8: Turn off "Toolbar icon reflects the current site" → all tabs normal without
      reload; turn on → colours return.
- [ ] m9: index.html "Cracked / pirated software" section matches DEMO.md: listed host
      → Suspicious with source name and the "official site or a trusted store" advice;
      listed + keywords + .exe → still Suspicious; one keyword / "crack the interview" →
      No known threats found. Clicking the listed host does not open the warning page.
- [ ] m9: Feed table shows "HaGeZi's Anti-Piracy" updated (online) and the bundled
      pirated-software demo list. Turn off "Cracked / pirated software" → software
      reasons gone without reload; the two piracy lists are not downloaded while off.
- [ ] m10: Settings → language ಕನ್ನಡ: the settings page switches without reload, both
      columns fit (no sideways scroll at wide or narrow width; feed table buttons not
      clipped). Demo tooltips, the demo mailbox banner, the toolbar tooltip and the
      warning page show Kannada tier names and text; reasons stay English; "No known
      threats found" is ತಿಳಿದಿರುವ ಯಾವುದೇ ಅಪಾಯ ಕಂಡುಬಂದಿಲ್ಲ (never ಸುರಕ್ಷಿತ). Kannada glyphs
      render (no boxes). Switch back to English: everything returns without reload.
- [ ] m7: README, FEEDS, PRIVACY and DEMO match behaviour (permissions table equals
      manifest.json; feed URLs equal src/config/feeds.js).
