// Feed download failure is reported and leaves other feeds/data intact.
import { setSetting } from './helpers.mjs';
import { extPage } from './01-background.mjs';

export default async function ({ browser, extId, fail }) {
  const opts = await extPage(browser, extId, 'src/ui/options/options.html');
  const msg = (type, payload) => opts.evaluate((type, payload) => chrome.runtime.sendMessage({ type, payload }).then((r) => r.result), type, payload);
  const before = (await msg('feed-status')).status;

  await setSetting(browser, extId, { urlhausAuthKey: '', feeds: { urlhaus: true } });
  let st = await msg('feed-refresh', { id: 'urlhaus' });
  if (st?.error !== 'Auth-Key not set') fail(`urlhaus without key: ${JSON.stringify(st)}`);

  await setSetting(browser, extId, { urlhausAuthKey: 'notarealkey12345678', feeds: { urlhaus: true } });
  st = await msg('feed-refresh', { id: 'urlhaus' });
  if (!st?.error || st.activeGen) fail(`urlhaus with bad key should fail without data: ${JSON.stringify(st)}`);
  console.log(`  urlhaus bad key -> ${st?.error}`);

  const after = (await msg('feed-status')).status;
  if (after.sample?.activeGen !== before.sample?.activeGen) fail('sample feed changed by an unrelated failure');
  const v = await msg('analyze-url', { url: 'http://malicious.aspida-demo.invalid/' });
  if (v.tier !== 'malicious') fail('bundled feed stopped matching after a failed refresh');

  // The options page shows the error.
  await opts.reload();
  await opts.waitForSelector('#feeds tbody tr');
  const errText = await opts.$$eval('#feeds .err', (es) => es.map((e) => e.textContent).join(' '));
  if (!/Last attempt failed/.test(errText)) fail(`options page doesn't show feed error: "${errText}"`);

  await setSetting(browser, extId, { urlhausAuthKey: '', feeds: { urlhaus: false } });
  await opts.close();
}
