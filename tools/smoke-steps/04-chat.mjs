// m5: chat scanner on the offline WhatsApp-like mock.
import { sleep, waitFor, aspidaShadows, setSetting } from './helpers.mjs';

const badges = async (page) => (await aspidaShadows(page)).filter((s) => s.kind === 'badge').map((s) => s.text);

export default async function ({ browser, extId, base, fail }) {
  const page = await browser.newPage();
  await page.goto(`${base}/chat-mock.html`);
  const linksHtml = () => page.$$eval('#main a', (as) => as.map((a) => a.outerHTML));
  const originalLinks = await linksHtml();
  const initial = await waitFor(async () => {
    const b = await badges(page);
    return b.length >= 3 ? b : null;
  }, 'chat badges', 8000).catch(() => null);
  const got = initial || (await badges(page));
  const joined = got.join(' | ');
  if (got.length !== 3) fail(`expected 3 chat badges (jio, sbi, feed), got ${got.length}: ${joined}`);
  if (!/Known malicious/.test(joined)) fail(`feed link badge missing: ${joined}`);
  if (!/Suspicious|High risk/.test(joined)) fail(`heuristic badge missing: ${joined}`);

  // Badge is placed right after the risky link, nowhere else.
  const placement = await page.evaluate(() => ['chat-sbi', 'chat-feed', 'chat-clean'].map((id) => document.getElementById(id).nextElementSibling?.hasAttribute('data-aspida-badge') || false));
  if (placement.join() !== 'true,true,false') fail(`badge placement wrong: ${placement}`);

  // New incoming message is picked up by the MutationObserver.
  await page.click('#add');
  await waitFor(async () => (await badges(page)).length === 4, 'badge on new message', 6000).catch(() => fail('no badge on simulated new message'));

  // Message text and links themselves untouched.
  const nowLinks = (await linksHtml()).slice(0, originalLinks.length);
  if (nowLinks.join() !== originalLinks.join()) fail(`chat links modified: ${nowLinks}`);

  // Disable → badges removed live.
  await setSetting(browser, extId, { chatWhatsApp: false });
  await sleep(600);
  if ((await badges(page)).length) fail('badges not removed after disabling chatWhatsApp');
  await setSetting(browser, extId, { chatWhatsApp: true });
  await page.close();
}
