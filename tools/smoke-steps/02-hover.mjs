// m3: hover tooltip on the demo page, live disable, heavy page.
import { sleep, waitFor, overlayText, setSetting } from './helpers.mjs';

export default async function ({ browser, extId, base, fail }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(`${base}/index.html`);
  await sleep(1200); // content script + pre-check of visible links

  const expectHover = async (sel, re, what) => {
    await page.mouse.move(5, 5);
    await page.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }));
    await sleep(250); // scrolling hides the tooltip by design; let it settle first
    await page.hover(sel);
    try {
      const text = await waitFor(async () => {
        const t = await overlayText(page);
        return re.test(t) ? t : null;
      }, what, 5000);
      return text;
    } catch {
      fail(`hover ${sel}: expected ${re}, got "${await overlayText(page)}"`);
      return '';
    }
  };

  const t1 = await expectHover('#typo-visual', /High risk/, 'typosquat tooltip');
  if (t1 && !/paypal\.com/.test(t1)) fail(`typosquat tooltip lacks evidence: ${t1}`);
  await expectHover('#feed-host', /Known malicious/, 'feed tooltip');
  await expectHover('#clean li:nth-child(3) a', /No known threats found/, 'clean tooltip');
  await expectHover('#homoglyph', /High risk.*apple\.com/, 'homoglyph tooltip');
  await expectHover('#text-mismatch', /shows icicibank\.com/, 'text mismatch tooltip');
  await expectHover('#at-sign', /High risk/, '@ tooltip');

  // Host page untouched: no attributes or nodes added to links.
  const modified = await page.$$eval('a', (as) => as.filter((a) => a.attributes.length > 2 || a.children.length).length);
  if (modified) fail(`${modified} links were modified`);

  // Live disable: tooltip stops without reload.
  await setSetting(browser, extId, { hoverVerdict: false });
  await sleep(400);
  await page.mouse.move(5, 5);
  await page.hover('#brand-sbi');
  await sleep(900);
  if (await overlayText(page)) fail('tooltip still shown after disabling hoverVerdict');
  await setSetting(browser, extId, { hoverVerdict: true });
  await page.close();

  // Heavy page: loads, scrolls, tooltip still works far down the page.
  const heavy = await browser.newPage();
  await heavy.setViewport({ width: 1100, height: 900 });
  const t0 = Date.now();
  await heavy.goto(`${base}/heavy.html`);
  await sleep(800);
  await heavy.evaluate(() => document.getElementById('l4950').scrollIntoView());
  await sleep(800);
  await heavy.hover('#l4950');
  await waitFor(async () => /Suspicious|High risk/.test(await overlayText(heavy)), 'heavy page tooltip', 5000).catch(() => fail('heavy page: no tooltip on #l4950'));
  console.log(`  heavy page ok in ${Date.now() - t0} ms`);
  await heavy.close();
}
