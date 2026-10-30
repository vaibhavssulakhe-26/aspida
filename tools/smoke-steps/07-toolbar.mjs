// Toolbar icon follows the current site (demo/toolbar.html under *.localhost
// names, which Chrome resolves to this machine). Checks the icon file each
// tab really got (setIcon must succeed) and the per-tab title.
import { sleep, waitFor, setSetting } from './helpers.mjs';

export default async function ({ browser, worker, extId, base, fail }) {
  const port = new URL(base).port;
  // Record every setIcon call and whether Chrome accepted it.
  await worker.evaluate(() => {
    self.__icons = [];
    const orig = chrome.action.setIcon.bind(chrome.action);
    chrome.action.setIcon = (d) => {
      const rec = { tabId: d.tabId, path: Object.values(d.path || {})[0], ok: null };
      self.__icons.push(rec);
      return orig(d).then((r) => ((rec.ok = true), r), (e) => ((rec.ok = e.message), Promise.reject(e)));
    };
  });
  const tabState = (tabId) =>
    worker.evaluate(async (tabId) => {
      const last = self.__icons.filter((d) => d.tabId === tabId).pop();
      return { title: await chrome.action.getTitle({ tabId }), icon: last?.path || '', ok: last?.ok ?? null };
    }, tabId);
  // Our tab: the one whose top frame shows the page's URL.
  const tabIdOf = (url) =>
    worker.evaluate(async (url) => {
      for (const t of await chrome.tabs.query({})) {
        const f = await chrome.webNavigation.getFrame({ tabId: t.id, frameId: 0 }).catch(() => null);
        if (f?.url === url) return t.id;
      }
      return null;
    }, url);

  const page = await browser.newPage();
  let tabId = null;
  const expect = async (what, state, titleRe) => {
    tabId ??= await tabIdOf(page.url());
    const st = await waitFor(async () => {
      const s = tabId === null ? null : await tabState(tabId);
      return s && s.ok === true && s.icon.includes(`/${state}-`) && titleRe.test(s.title) ? s : null;
    }, `${what} icon`, 5000).catch(async () => null);
    if (!st) fail(`toolbar ${what}: expected ${state} / ${titleRe}, got ${JSON.stringify(tabId === null ? 'tab not found' : await tabState(tabId))}`);
  };

  await page.goto(`http://localhost:${port}/toolbar.html`);
  await expect('localhost', 'green', /No known threats found/);
  const title = await worker.evaluate((tabId) => chrome.action.getTitle({ tabId }), tabId);
  if (/\bsafe/i.test(title)) fail(`toolbar title says safe: ${title}`);

  await page.click('#icon-orange');
  await page.waitForNavigation().catch(() => {});
  await expect('amazon-deals.localhost', 'orange', /Suspicious/);

  // Same document, new URL (SPA): onHistoryStateUpdated recomputes.
  await page.evaluate(() => history.pushState({}, '', '/paypal/login/verify'));
  await expect('pushState to a brand/login path', 'red', /High risk/);

  // High risk navigation: the warning page (extension page) gets the normal icon.
  await page.goto(`http://paypa1.localhost:${port}/toolbar.html`).catch(() => {});
  await waitFor(() => page.url().startsWith('chrome-extension://'), 'warning page', 5000).catch(() => fail(`paypa1.localhost was not intercepted: ${page.url()}`));
  await expect('warning page', 'normal', /^Aspida settings$/);
  await setSetting(browser, extId, { blockHighRisk: false });
  await page.goto(`http://paypa1.localhost:${port}/toolbar.html`);
  await expect('paypa1.localhost (guard off)', 'red', /High risk/);

  // Back/forward cache restores recompute too.
  await page.goto(`http://localhost:${port}/toolbar.html`);
  await expect('localhost again', 'green', /No known threats found/);
  await page.goBack();
  await expect('back to paypa1', 'red', /High risk/);

  // Setting off: every tab back to normal, without reload; on: recomputed.
  await setSetting(browser, extId, { toolbarIcon: false });
  await expect('setting off', 'normal', /^Aspida settings$/);
  await setSetting(browser, extId, { toolbarIcon: true, blockHighRisk: true });
  await expect('setting back on', 'red', /High risk/);
  await page.close();

  // Non-web page: normal.
  const nt = await browser.newPage();
  await nt.goto('chrome://version/').catch(() => {}); // (the new-tab page makes its own Google requests)
  await sleep(300);
  const ntTab = await tabIdOf(nt.url());
  const ntState = ntTab === null ? null : await tabState(ntTab);
  if (!ntState || !ntState.icon.includes('/normal-') || ntState.ok !== true) fail(`chrome://version: expected normal icon, got ${JSON.stringify(ntState)}`);
  await nt.close();
}
