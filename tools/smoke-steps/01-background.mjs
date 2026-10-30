// m2: feeds load, messaging works, warning page interstitial, options page.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function extPage(browser, extId, path) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/${path}`);
  return page;
}

async function waitFor(fn, what, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}`);
}

export default async function ({ browser, extId, fail }) {
  const opts = await extPage(browser, extId, 'src/ui/options/options.html');
  const msg = (type, payload) => opts.evaluate((type, payload) => chrome.runtime.sendMessage({ type, payload }).then((r) => r.result), type, payload);

  // Bundled feed is loaded on install.
  await waitFor(async () => (await msg('feed-status')).status.sample?.activeGen, 'sample feed');

  const v1 = await msg('analyze-url', { url: 'http://malicious.aspida-demo.invalid/anything' });
  if (v1.tier !== 'malicious') fail(`feed host match expected malicious, got ${v1.tier}`);
  const v2 = await msg('analyze-url', { url: 'https://login-verify.aspida-demo.invalid/hdfc/netbanking/login.php' });
  if (v2.tier !== 'malicious') fail(`feed url match expected malicious, got ${v2.tier}`);
  const v3 = await msg('analyze-url', { url: 'https://www.wikipedia.org/' });
  if (v3.tier !== 'none') fail(`wikipedia expected none, got ${v3.tier}`);

  // Options page rendered its sections.
  const counts = await opts.evaluate(() => ({ toggles: document.querySelectorAll('#features input').length, feeds: document.querySelectorAll('#feeds tbody tr').length }));
  if (counts.toggles < 8 || counts.feeds !== 6) fail(`options page incomplete: ${JSON.stringify(counts)}`);

  // Layout: Features left / Threat feeds right on wide screens, stacked on
  // narrow ones; Features first in tab order; no horizontal scrolling.
  const layout = () => opts.evaluate(() => {
    const f = document.getElementById('features-section').getBoundingClientRect();
    const t = document.getElementById('feeds-section').getBoundingClientRect();
    const a = document.querySelector('section[aria-labelledby="h-allow"]').getBoundingClientRect();
    const focusables = [...document.querySelectorAll('input, button')];
    return {
      sideBySide: Math.abs(f.top - t.top) < 2 && f.right <= t.left,
      stacked: t.top >= f.bottom,
      allowBelow: a.top >= Math.max(f.bottom, t.bottom),
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      featuresFirst: focusables[0]?.closest('section')?.id === 'features-section',
    };
  });
  await opts.setViewport({ width: 1280, height: 900 });
  const wide = await layout();
  if (!wide.sideBySide || !wide.allowBelow || wide.hScroll || !wide.featuresFirst) fail(`options wide layout: ${JSON.stringify(wide)}`);
  await opts.setViewport({ width: 600, height: 900 });
  const narrow = await layout();
  if (!narrow.stacked || !narrow.allowBelow || narrow.hScroll) fail(`options narrow layout: ${JSON.stringify(narrow)}`);

  // Interstitial on a known-malicious navigation.
  const tab = await browser.newPage();
  await tab.goto('http://malicious.aspida-demo.invalid/login').catch(() => {});
  await waitFor(() => tab.url().includes('/src/ui/warning/warning.html'), 'warning page');
  await tab.waitForSelector('#verdict .tl-label');
  const label = await tab.$eval('#verdict .tl-label', (e) => e.textContent);
  if (label !== 'Known malicious') fail(`warning page label: ${label}`);
  const evidence = await tab.$$eval('#verdict .tl-evidence', (es) => es.map((e) => e.textContent));
  if (!evidence.includes('malicious.aspida-demo.invalid')) fail(`warning page evidence missing: ${evidence}`);

  // Proceed anyway: navigates to the target and is not re-blocked.
  await tab.click('#proceed');
  await sleep(1500);
  if (tab.url().includes('warning.html')) fail('proceed anyway did not leave the warning page');
  await tab.close();

  // High-risk heuristic also interstitials (blockHighRisk default on).
  const tab3 = await browser.newPage();
  await tab3.goto('https://paypa1.test/signin').catch(() => {});
  await waitFor(() => tab3.url().includes('/src/ui/warning/warning.html'), 'warning page for High risk').catch(() => fail(`High-risk navigation not stopped: ${tab3.url()}`));
  await tab3.close();

  const tab2 = await browser.newPage();
  await tab2.goto('http://paypa1.aspida-demo.invalid/').catch(() => {});
  await sleep(1000);
  // paypa1.aspida-demo.invalid has no lookalike registrable domain: must NOT be blocked.
  if (tab2.url().includes('warning.html')) fail('non-risky .invalid host was blocked');
  await tab2.close();

  // Allowlist round-trip.
  await msg('allowlist-add', { target: 'https://sbi-login.xyz/' });
  const al = await msg('analyze-url', { url: 'https://sbi-login.xyz/' });
  if (!al.allowlisted) fail('allowlist not applied');
  await msg('allowlist-remove', { domain: 'sbi-login.xyz' });
  const al2 = await msg('analyze-url', { url: 'https://sbi-login.xyz/' });
  if (al2.tier !== 'high') fail(`after allowlist removal expected high, got ${al2.tier}`);

  // Remote feed status (network dependent: report, don't fail offline).
  await sleep(3000);
  const st = (await msg('feed-status')).status;
  for (const id of ['openphish', 'phishing-database']) {
    const s = st[id] || {};
    console.log(`  feed ${id}: gen=${s.activeGen || 0} urls=${s.urls || 0} hosts=${s.hosts || 0} error=${s.error || '-'}`);
  }

  // Clear all data re-seeds the bundled feed.
  await msg('clear-all');
  const after = await msg('feed-status');
  if (!after.status.sample?.activeGen) fail('sample feed not re-seeded after clear-all');
  await opts.close();
}
