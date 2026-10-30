// m5: chat scanner on the offline WhatsApp-like mock. Default: verdicts on
// hover only (no inline badges). Opt-in "Show inline badges in chat".
import { sleep, waitFor, aspidaShadows, overlayText, setSetting } from './helpers.mjs';

const badges = async (page) => (await aspidaShadows(page)).filter((s) => s.kind === 'badge').map((s) => s.text);

export default async function ({ browser, extId, base, fail }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(`${base}/chat-mock.html`);
  const linksHtml = () => page.$$eval('#main a', (as) => as.map((a) => a.outerHTML));
  const originalLinks = await linksHtml();

  // Default: no persistent badges, hover shows the verdict.
  await sleep(1500);
  if ((await badges(page)).length) fail(`inline chat badges shown by default: ${await badges(page)}`);
  for (const [sel, re] of [['#chat-sbi', /Suspicious|High risk/], ['#chat-feed', /Known malicious/], ['#chat-clean', /No known threats found/]]) {
    await page.mouse.move(2, 2);
    await sleep(200);
    await page.hover(sel);
    await waitFor(async () => re.test(await overlayText(page)), `hover ${sel}`, 5000).catch(async () => fail(`chat hover ${sel}: expected ${re}, got "${await overlayText(page)}"`));
  }
  await page.mouse.move(2, 2);

  // Opt-in badges: appear live after the risky links only.
  await setSetting(browser, extId, { chatInlineBadges: true });
  const got = await waitFor(async () => {
    const b = await badges(page);
    return b.length >= 3 ? b : null;
  }, 'chat badges', 8000).catch(() => badges(page));
  const joined = got.join(' | ');
  if (got.length !== 3) fail(`expected 3 chat badges (jio, sbi, feed), got ${got.length}: ${joined}`);
  if (!/Known malicious/.test(joined)) fail(`feed link badge missing: ${joined}`);
  if (!/Suspicious|High risk/.test(joined)) fail(`heuristic badge missing: ${joined}`);
  const placement = await page.evaluate(() => ['chat-sbi', 'chat-feed', 'chat-clean'].map((id) => document.getElementById(id).nextElementSibling?.hasAttribute('data-aspida-badge') || false));
  if (placement.join() !== 'true,true,false') fail(`badge placement wrong: ${placement}`);

  // New incoming message is picked up by the MutationObserver.
  await page.click('#add');
  await waitFor(async () => (await badges(page)).length === 4, 'badge on new message', 6000).catch(() => fail('no badge on simulated new message'));

  // A recycled message element whose link now points to a clean site loses its badge.
  await page.$eval('#chat-sbi', (a) => {
    a.href = 'https://en.wikipedia.org/wiki/Phishing';
    a.textContent = 'https://en.wikipedia.org/wiki/Phishing';
  });
  await waitFor(async () => (await badges(page)).length === 3, 'badge removed from recycled link', 6000).catch(async () => fail(`stale badge kept on a recycled clean link: ${await badges(page)}`));
  if (await page.$eval('#chat-sbi', (a) => a.nextElementSibling?.hasAttribute('data-aspida-badge') || false)) fail('recycled clean link still badged');

  // Message text and links themselves untouched (apart from our own edit above).
  const nowLinks = (await linksHtml()).slice(0, originalLinks.length);
  const changed = nowLinks.filter((h, i) => h !== originalLinks[i] && !h.includes('id="chat-sbi"'));
  if (changed.length) fail(`chat links modified: ${changed}`);

  // Badges off again -> removed live. Then the per-app switch also removes them.
  await setSetting(browser, extId, { chatInlineBadges: false });
  await sleep(600);
  if ((await badges(page)).length) fail('badges not removed after disabling chatInlineBadges');
  await setSetting(browser, extId, { chatInlineBadges: true });
  await waitFor(async () => (await badges(page)).length === 3, 'badges back', 6000).catch(() => fail('badges did not come back after re-enabling'));
  await setSetting(browser, extId, { chatWhatsApp: false });
  await sleep(600);
  if ((await badges(page)).length) fail('badges not removed after disabling chatWhatsApp');
  await setSetting(browser, extId, { chatWhatsApp: true, chatInlineBadges: false });
  await page.close();
}
