// Demo mailbox (demo/mail.html): the real Gmail module on a webmail-style
// page with 3 genuine and 3 phishing emails, opened one at a time.
import { sleep, waitFor, aspidaShadows, setSetting } from './helpers.mjs';
import { PNG } from './png.mjs';

const banners = async (page) => (await aspidaShadows(page)).filter((s) => s.kind === 'banner').map((s) => s.text);
const rowStyles = (page) => page.$$eval('tr.zA', (rs) => Object.fromEntries(rs.map((r) => [r.id, r.getAttribute('style') || ''])));

const EXPECT = {
  kyc: [/High risk/, /claims to be SBI/, /Replies would go to gmail\.com/, /shows onlinesbi\.sbi but it opens onlinesbi-kyc\.test/],
  parcel: [/Suspicious/, /claims to be India Post/, /shows bit\.ly but it opens ip-customs\.test/],
  otp: [/High risk/, /paytrn\.test/, /paytm\.com/],
  meeting: [/No known threats found/],
  newsletter: [/No known threats found/],
  order: [/No known threats found/],
};

export default async function ({ browser, extId, base, fail }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/mail.html`);
  if (!/^Aspmail: Aspida demo mailbox, not real mail$/.test(await page.title())) fail(`mailbox title: ${await page.title()}`);
  if (!(await page.$eval('header', (h) => h.textContent)).includes('Aspida demo, not real mail')) fail('mailbox header lacks the demo label');
  if (await page.$('.hint')) fail('mailbox still shows the removed hint / footer text');
  await sleep(800);
  if ((await banners(page)).length) fail('mailbox: banner shown before any email was opened');

  for (const [id, res] of Object.entries(EXPECT)) {
    if (await page.$eval('#list', (l) => l.hidden)) await page.click('#back');
    await page.click(`#row-${id}`);
    const got = await waitFor(async () => {
      const b = await banners(page);
      return b.length === 1 && res.every((re) => re.test(b[0])) ? b : null;
    }, `mailbox banner for ${id}`, 8000).catch(async () => banners(page));
    if (got.length !== 1) fail(`mailbox ${id}: expected 1 banner, got ${got.length}: ${got.join(' | ')}`);
    for (const re of res) if (!re.test(got[0] || '')) fail(`mailbox ${id}: banner lacks ${re}: ${got[0]}`);
    if (/\bsafe\b/i.test(got[0] || '')) fail(`mailbox ${id}: banner says safe`);
  }

  // Back to the inbox for highlighting.
  await page.click('#back');
  if (await page.$eval('#list', (l) => l.hidden)) fail('mailbox: "Back to Inbox" did not show the list');

  // Inbox highlighting (opt-in): phishing rows coloured, genuine rows untouched.
  let styles = await rowStyles(page);
  if (Object.values(styles).some(Boolean)) fail(`mailbox rows styled while highlighting is off: ${JSON.stringify(styles)}`);
  await setSetting(browser, extId, { gmailInboxHighlight: true });
  await waitFor(async () => (await rowStyles(page))['row-otp'], 'mailbox row highlight', 6000).catch(() => {});
  styles = await rowStyles(page);
  if (!/207, 34, 46/.test(styles['row-kyc'])) fail(`mailbox KYC row not red: ${styles['row-kyc']}`);
  if (!/207, 34, 46/.test(styles['row-otp'])) fail(`mailbox OTP row not red: ${styles['row-otp']}`);
  if (Object.values(styles).some((s) => /box-shadow/.test(s))) fail(`inbox rows still have a stripe: ${JSON.stringify(styles)}`);
  if (!/212, 167, 44/.test(styles['row-parcel'])) fail(`mailbox parcel row not yellow: ${styles['row-parcel']}`);
  for (const id of ['row-meeting', 'row-newsletter', 'row-order']) if (styles[id]) fail(`mailbox genuine row ${id} styled: ${styles[id]}`);
  // And it really renders: the row's left edge shows the soft tint (no
  // coloured stripe), sampled from a screenshot.
  await page.mouse.move(1279, 899);
  await sleep(200);
  const png = PNG(await page.screenshot());
  const edges = await page.$$eval('tr.zA', (rs) => rs.map((r) => { const b = r.getBoundingClientRect(); return [r.id, Math.round(b.x + 1), Math.round(b.y + b.height / 2)]; }));
  const want = { 'row-kyc': [249, 228, 230], 'row-otp': [249, 228, 230], 'row-parcel': [249, 243, 225] };
  for (const [id, x, y] of edges) {
    const got = png.at(x, y);
    const exp = want[id] || [255, 255, 255];
    if (got.some((v, i) => Math.abs(v - exp[i]) > 12)) fail(`mailbox ${id}: rendered edge colour ${got} (expected about ${exp})`);
  }
  await setSetting(browser, extId, { gmailInboxHighlight: false });
  await sleep(600);
  styles = await rowStyles(page);
  if (Object.values(styles).some(Boolean)) fail(`mailbox row styles not reverted: ${JSON.stringify(styles)}`);

  // A link to one email (mail.html#otp) opens it.
  await page.goto(`${base}/mail.html#otp`);
  await waitFor(async () => (await banners(page)).some((b) => /High risk/.test(b)), 'mailbox #otp banner', 8000).catch(() => fail('mailbox: #otp did not open with a banner'));
  await page.close();
}
