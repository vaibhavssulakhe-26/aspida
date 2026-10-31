// Interface language: Kannada applies live to the options page, tooltips,
// email banners, the warning page and the toolbar title; English fallback.
import { sleep, waitFor, overlayText, aspidaShadows, setSetting } from './helpers.mjs';

const KN = { high: 'ಹೆಚ್ಚಿನ ಅಪಾಯ', none: 'ತಿಳಿದಿರುವ ಯಾವುದೇ ಅಪಾಯ ಕಂಡುಬಂದಿಲ್ಲ', features: 'ವೈಶಿಷ್ಟ್ಯಗಳು', warningBack: 'ಹಿಂದಕ್ಕೆ ಹೋಗಿ' };

export default async function ({ browser, worker, extId, base, fail }) {
  // Options page: switch with the dropdown, applies without reload.
  const opts = await browser.newPage();
  await opts.setViewport({ width: 1280, height: 900 });
  await opts.goto(`chrome-extension://${extId}/src/ui/options/options.html`);
  await opts.waitForSelector('#features input');
  await opts.click('[data-lang="kn"]');
  await waitFor(() => opts.$eval('#h-features', (h) => h.textContent).then((x) => x === KN.features), 'options page in Kannada', 5000).catch(() => {});
  const o = await opts.evaluate(() => ({
    lang: document.documentElement.lang,
    h: document.getElementById('h-features').textContent,
    tab: document.getElementById('tab-about').textContent,
    pressed: document.querySelector('[data-lang="kn"]').getAttribute('aria-pressed'),
    label: document.querySelector('label[for="f-hoverVerdict"]').textContent,
    hint: !document.getElementById('lang-hint').hidden,
    hscroll: document.documentElement.scrollWidth > innerWidth,
    font: getComputedStyle(document.body).fontFamily,
  }));
  if (o.lang !== 'kn' || o.h !== KN.features || o.tab !== 'ಪರಿಚಯ' || o.pressed !== 'true' || !o.hint || !/Kannada/.test(o.font)) fail(`options page not switched to Kannada: ${JSON.stringify(o)}`);
  if (/[A-Za-z]{4,}/.test(o.label)) fail(`feature label still English: ${o.label}`);
  if (o.hscroll) fail('options page scrolls sideways in Kannada at 1280 px');
  await opts.setViewport({ width: 600, height: 900 });
  if (await opts.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail('options page scrolls sideways in Kannada at 600 px');

  // Tooltip on an already-open page.
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(`${base}/index.html`);
  await sleep(1000);
  await page.hover('#typo-visual');
  const tip = await waitFor(async () => ((await overlayText(page)).includes(KN.high) ? overlayText(page) : null), 'Kannada tooltip', 5000).catch(async () => overlayText(page));
  if (!tip.includes(KN.high)) fail(`tooltip not in Kannada: "${tip}"`);
  if (!/paypal\.com/.test(tip)) fail(`tooltip lost its (English) reason: "${tip}"`);
  await page.mouse.move(5, 5);

  // Email banner re-rendered live.
  const mail = await browser.newPage();
  await mail.goto(`${base}/mail.html#meeting`);
  await waitFor(async () => (await aspidaShadows(mail)).some((s) => s.kind === 'banner' && s.text.includes(KN.none)), 'Kannada banner', 8000).catch(async () => fail(`banner not in Kannada: ${(await aspidaShadows(mail)).map((s) => s.text).join(' | ')}`));

  // Toolbar title for the demo page's tab.
  const title = await worker.evaluate(async () => {
    for (const t of await chrome.tabs.query({})) {
      const f = await chrome.webNavigation.getFrame({ tabId: t.id, frameId: 0 }).catch(() => null);
      if (f?.url?.endsWith('/mail.html#meeting')) return chrome.action.getTitle({ tabId: t.id });
    }
    return '';
  });
  if (!title.startsWith('Aspida: ') || !title.includes('ತಿಳಿದಿರುವ ಯಾವುದೇ ಅಪಾಯ')) fail(`toolbar title not in Kannada: "${title}"`);

  // Warning page.
  const warn = await browser.newPage();
  await warn.goto(`chrome-extension://${extId}/src/ui/warning/warning.html?url=${encodeURIComponent('http://malicious.aspida-demo.invalid/login')}`);
  await waitFor(() => warn.$eval('#back', (b) => b.textContent === 'ಹಿಂದಕ್ಕೆ ಹೋಗಿ'), 'Kannada warning page', 5000).catch(async () => fail(`warning page not in Kannada: ${await warn.$eval('#back', (b) => b.textContent)}`));

  // Back to English everywhere, live.
  await setSetting(browser, extId, { uiLanguage: 'en' });
  await waitFor(() => warn.$eval('#back', (b) => b.textContent === 'Go back'), 'warning page back to English', 5000).catch(() => fail('warning page did not switch back to English'));
  await waitFor(() => opts.$eval('#h-features', (h) => h.textContent === 'Features'), 'options back to English', 5000).catch(() => fail('options page did not switch back to English'));
  await waitFor(async () => (await aspidaShadows(mail)).some((s) => s.kind === 'banner' && s.text.includes('No known threats found')), 'English banner', 8000).catch(() => fail('banner did not switch back to English'));
  for (const p of [opts, page, mail, warn]) await p.close();
}
