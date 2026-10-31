// Feed download failure is reported and leaves other feeds/data intact.
// The failure is simulated by blocking the OpenPhish URL in the worker.
import { setSetting, waitFor } from './helpers.mjs';
import { extPage } from './01-background.mjs';

export default async function ({ browser, worker, extId, fail }) {
  const opts = await extPage(browser, extId, 'src/ui/options/options.html#feeds');
  const msg = (type, payload) => opts.evaluate((type, payload) => chrome.runtime.sendMessage({ type, payload }).then((r) => r.result), type, payload);
  const before = (await msg('feed-status')).status;

  await worker.client.send('Network.setBlockedURLs', { urls: ['*openphish/public_feed*'] });
  let st;
  try {
    await setSetting(browser, extId, { feeds: { openphish: true } });
    st = await msg('feed-refresh', { id: 'openphish' });
  } finally {
    await worker.client.send('Network.setBlockedURLs', { urls: [] });
  }
  if (!st?.error) fail(`blocked OpenPhish download should fail: ${JSON.stringify(st)}`);
  if ((before.openphish?.activeGen || 0) !== (st?.activeGen || 0)) fail('failed refresh replaced the last good copy');
  console.log(`  openphish blocked -> ${st?.error}`);

  const after = (await msg('feed-status')).status;
  if (after.sample?.activeGen !== before.sample?.activeGen) fail('sample feed changed by an unrelated failure');
  const v = await msg('analyze-url', { url: 'http://malicious.aspida-demo.invalid/' });
  if (v.tier !== 'malicious') fail('bundled feed stopped matching after a failed refresh');

  // The options page shows the error on the Threat feeds tab.
  await opts.reload();
  await opts.waitForSelector('#feeds tbody tr');
  await waitFor(() => opts.$$eval('#feeds .err', (es) => es.length > 0), 'feed error row', 5000).catch(() => {});
  const errText = await opts.$$eval('#feeds .err', (es) => es.map((e) => e.textContent).join(' '));
  if (!/Last attempt failed/.test(errText)) fail(`options page doesn't show feed error: "${errText}"`);
  if (await opts.$eval('#panel-feeds', (p) => p.hidden)) fail('#feeds in the address did not open the Threat feeds tab');
  await opts.close();
}
