// Cracked / pirated software: tooltip with advice, Suspicious at most, no
// warning page, live switch.
import { sleep, waitFor, overlayText, setSetting } from './helpers.mjs';

const ADVICE = /listed as distributing cracked or pirated software.*official site or a trusted store/;

export default async function ({ browser, extId, base, fail }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(`${base}/index.html`);
  await sleep(1200);
  const hover = async (sel) => {
    await page.mouse.move(5, 5);
    await page.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }));
    await sleep(250);
    await page.hover(sel);
    return waitFor(async () => (await overlayText(page)) || null, `tooltip ${sel}`, 5000).catch(() => '');
  };
  const expect = async (sel, re, notRe) => {
    const t = await hover(sel);
    if (!re.test(t)) fail(`software ${sel}: expected ${re}, got "${t}"`);
    if (notRe && notRe.test(t)) fail(`software ${sel}: should not match ${notRe}: "${t}"`);
    if (/\bsafe\b|illegal/i.test(t)) fail(`software ${sel}: wording: "${t}"`);
  };
  await expect('#sw-listed', /Suspicious.*Listed in the pirated-software category \(source: Bundled pirated-software demo list\)/, /High risk|Known malicious/);
  const listed = await overlayText(page);
  if (!ADVICE.test(listed)) fail(`software advice missing: "${listed}"`);
  await expect('#sw-all', /Suspicious/, /High risk|Known malicious/);
  await expect('#sw-keywords', /Suspicious.*crack, keygen/);
  await expect('#sw-one-word', /No known threats found/, /cracked software/);
  await expect('#sw-interview', /No known threats found/, /cracked software/);

  // Navigating to a listed site is not intercepted (tooltip-only category).
  const nav = await browser.newPage();
  await nav.goto('https://crackzone-downloads.test/').catch(() => {});
  await sleep(800);
  if (nav.url().startsWith('chrome-extension://')) fail('piracy-listed site was sent to the warning page');
  await nav.close();

  // Switch off: no software reasons, without reload.
  await setSetting(browser, extId, { softwareChecks: false });
  await sleep(500);
  await expect('#sw-listed', /No known threats found/, /pirated-software/);
  await setSetting(browser, extId, { softwareChecks: true });
  await sleep(500);
  await expect('#sw-listed', /Suspicious/);
  await page.close();
}
