// m6: Gmail banner on the offline mock; inbox highlighting toggle.
import { sleep, waitFor, trustlensShadows, setSetting } from './helpers.mjs';

const banners = async (page) => (await trustlensShadows(page)).filter((s) => s.kind === 'banner').map((s) => s.text);
const rowStyles = (page) => page.$$eval('tr.zA', (rs) => Object.fromEntries(rs.map((r) => [r.id, r.getAttribute('style') || ''])));

export default async function ({ browser, extId, base, fail }) {
  const page = await browser.newPage();
  await page.goto(`${base}/gmail-mock.html`);
  const got = await waitFor(async () => {
    const b = await banners(page);
    return b.length === 2 ? b : null;
  }, 'two Gmail banners', 8000).catch(async () => banners(page));
  if (got.length !== 2) fail(`expected 2 banners, got ${got.length}: ${got.join(' | ')}`);
  const [phish, clean] = got;
  if (!/Known malicious/.test(phish || '')) fail(`phish banner should be Known malicious: ${phish}`);
  for (const re of [/Replies would go to gmail\.com/, /claims to be HDFC Bank/, /shows hdfcbank\.com but it opens hdfcbank-kyc\.test/, /SPF\/DKIM\/DMARC/]) {
    if (!re.test(phish || '')) fail(`phish banner lacks ${re}: ${phish}`);
  }
  if (!/No known threats found/.test(clean || '')) fail(`clean banner: ${clean}`);
  if (!/Reply-To isn't shown/.test(clean || '')) fail('clean banner should say Reply-To was not visible');

  // Inbox highlighting: off by default.
  await sleep(500);
  let styles = await rowStyles(page);
  if (Object.values(styles).some(Boolean)) fail(`rows styled while highlighting is off: ${JSON.stringify(styles)}`);
  await setSetting(browser, extId, { gmailInboxHighlight: true });
  await waitFor(async () => (await rowStyles(page))['row-lookalike'], 'row highlight', 6000).catch(() => {});
  styles = await rowStyles(page);
  if (!/207, 34, 46/.test(styles['row-lookalike'])) fail(`lookalike row not red: ${styles['row-lookalike']}`);
  if (!/212, 167, 44/.test(styles['row-freemail'])) fail(`freemail row not yellow: ${styles['row-freemail']}`);
  if (styles['row-clean'] || styles['row-brand-ok']) fail(`clean rows styled: ${JSON.stringify(styles)}`);
  // Turning it off restores the original (empty) inline styles.
  await setSetting(browser, extId, { gmailInboxHighlight: false });
  await sleep(600);
  styles = await rowStyles(page);
  if (Object.values(styles).some(Boolean)) fail(`row styles not reverted: ${JSON.stringify(styles)}`);

  // Banner toggle removes banners live.
  await setSetting(browser, extId, { gmailBanner: false });
  await sleep(600);
  if ((await banners(page)).length) fail('banners not removed after disabling gmailBanner');
  await setSetting(browser, extId, { gmailBanner: true });
  await page.close();
}
