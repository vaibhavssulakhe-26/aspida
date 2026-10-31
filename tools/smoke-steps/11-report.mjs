// "Report this link": button on risky tooltips only, confirm step with the
// exact (stripped) URL, copy, destination tabs via the worker, wrong-warning
// issue, close, setting switch, warning page. chrome.tabs.create is stubbed in
// the worker so no reporting site is actually loaded (privacy audit stays clean).
import { sleep, waitFor, overlayText, overlayPoint, clickOverlay, setSetting } from './helpers.mjs';

export default async function ({ browser, worker, extId, base, fail }) {
  await worker.evaluate(() => {
    self.__opened = [];
    chrome.tabs.create = async (props) => {
      self.__opened.push(props.url);
      return { id: -1 };
    };
  });
  const opened = () => worker.evaluate(() => self.__opened.splice(0));
  await browser.defaultBrowserContext().overridePermissions(base, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);

  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(`${base}/index.html`);
  await sleep(1200);
  const hover = async (sel, re) => {
    await page.mouse.move(5, 5);
    await page.keyboard.press('Escape');
    await page.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }));
    await sleep(300);
    await page.hover(sel);
    return waitFor(async () => {
      const t = await overlayText(page);
      return re.test(t) ? t : null;
    }, `tooltip ${sel}`, 6000).catch(async () => overlayText(page));
  };

  // Clean link: no button.
  const clean = await hover('#clean li:nth-child(3) a', /No known threats found/);
  if (/Report this link/.test(clean)) fail('report button shown on a "No known threats found" tooltip');

  // Known-malicious link with a query string.
  const tip = await hover('#feed-url', /Known malicious/);
  if (!/Report this link/.test(tip)) fail(`no report button on a Known malicious tooltip: "${tip}"`);
  if (!(await clickOverlay(page, 'tl-report-open'))) fail('could not reach the report button with the pointer');
  let text = await waitFor(async () => ((await overlayText(page)).includes('Report as suspicious') ? overlayText(page) : null), 'report step', 4000).catch(async () => overlayText(page));
  if (!/Report as suspicious/.test(text)) fail(`report step did not open: "${text}"`);
  if (/this is phishing|\bsafe\b(?! Browsing)/i.test(text)) fail(`report wording: "${text}"`);
  if (!/1930/.test(text)) fail('report step lacks the 1930 helpline line');

  // Query/fragment stripped by default (UPI reward link has ?id=4921).
  await page.keyboard.press('Escape');
  text = await hover('a[href*="upi-reward"]', /Known malicious/);
  await clickOverlay(page, 'tl-report-open');
  text = await waitFor(async () => ((await overlayText(page)).includes('Report as suspicious') ? overlayText(page) : null), 'report step 2', 4000).catch(async () => overlayText(page));
  if (!/https:\/\/upi-reward\.aspida-demo\.invalid\/claim(?!\?)/.test(text)) fail(`URL not stripped by default: "${text}"`);
  await clickOverlay(page, 'tl-report-strip');
  await sleep(150);
  if (!/claim\?id=4921/.test(await overlayText(page))) fail('unticking "Remove query string" did not show the full URL');
  await clickOverlay(page, 'tl-report-strip'); // back on

  // Copy URL.
  await clickOverlay(page, 'tl-report-copy');
  await sleep(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `ERR ${e.message}`);
  if (clip !== 'https://upi-reward.aspida-demo.invalid/claim') fail(`clipboard has "${clip}"`);
  if (!/URL copied\./.test(await overlayText(page))) fail('no "URL copied." status');

  // Destinations: Safe Browsing prefilled; Netcraft plain + auto-copy note.
  await clickOverlay(page, 'tl-report-dest'); // first = Safe Browsing
  await sleep(500);
  let urls = await opened();
  if (urls.length !== 1 || urls[0] !== 'https://safebrowsing.google.com/safebrowsing/report_phish/?url=https%3A%2F%2Fupi-reward.aspida-demo.invalid%2Fclaim') fail(`Safe Browsing tab: ${JSON.stringify(urls)}`);

  // Netcraft is the second destination button: click by data-dest via keyboard focus order.
  await page.keyboard.press('Escape');
  await hover('a[href*="upi-reward"]', /Known malicious/);
  await clickOverlay(page, 'tl-report-open');
  await sleep(300);
  // Tab from the checkbox: copy, Safe Browsing, Netcraft.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await sleep(500);
  urls = await opened();
  if (urls[0] !== 'https://report.netcraft.com/report') fail(`Netcraft tab: ${JSON.stringify(urls)}`);
  if (!/URL copied, paste it into the form/.test(await overlayText(page))) fail('Netcraft: no "paste it into the form" note');

  // Wrong warning -> GitHub issue with URL + signal ids.
  await clickOverlay(page, 'tl-report-issue');
  await sleep(500);
  urls = await opened();
  const issue = urls[0] ? new URL(urls[0]) : null;
  if (!issue || issue.pathname !== '/vaibhavssulakhe-26/aspida/issues/new' || !/Signals: feed\./.test(issue.searchParams.get('body') || '')) fail(`issue tab: ${JSON.stringify(urls)}`);

  // Close.
  // (The pointer may then rest on another link, whose own tooltip is fine.)
  await clickOverlay(page, 'tl-report-close');
  await sleep(400);
  if (/Report as suspicious/.test(await overlayText(page)) || (await overlayPoint(page, 'tl-report-close'))) fail('report step did not close');
  // Escape closes it too.
  await hover('#typo-visual', /High risk/);
  await clickOverlay(page, 'tl-report-open');
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(400);
  if (/Report as suspicious/.test(await overlayText(page))) fail('Escape did not close the report step');

  // Switch off: no button.
  await setSetting(browser, extId, { reportButton: false });
  await sleep(400);
  const off = await hover('#typo-visual', /High risk/);
  if (/Report this link/.test(off)) fail('report button shown with the setting off');
  await setSetting(browser, extId, { reportButton: true });
  await page.close();

  // Warning page.
  const warn = await browser.newPage();
  await warn.goto(`chrome-extension://${extId}/src/ui/warning/warning.html?url=${encodeURIComponent('https://paypa1.test/signin?session=abc#x')}`);
  await warn.waitForSelector('.tl-report-open', { timeout: 5000 }).catch(() => fail('warning page has no report button'));
  await warn.click('.tl-report-open');
  await warn.waitForSelector('.tl-report-url', { timeout: 3000 }).catch(() => {});
  const shown = await warn.$eval('.tl-report-url', (c) => c.textContent).catch(() => '');
  if (shown !== 'https://paypa1.test/signin') fail(`warning page report URL: "${shown}"`);
  await warn.click('[data-dest="cybercrime"]');
  await sleep(500);
  urls = await opened();
  if (urls[0] !== 'https://cybercrime.gov.in/') fail(`cybercrime tab: ${JSON.stringify(urls)}`);
  await warn.close();
  if ((await opened()).length) fail('unexpected extra tabs opened');
}
