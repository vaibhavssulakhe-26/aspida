// m4: QR hover on same-origin img, canvas, UPI, cross-origin without access.
import { sleep, waitFor, overlayText } from './helpers.mjs';

export default async function ({ browser, base, extId, fail }) {
  // Service-worker decode path directly: CORS-enabled image and a data: URL.
  const ext = await browser.newPage();
  await ext.goto(`chrome-extension://${extId}/src/ui/options/options.html`);
  const viaSw = (src) => ext.evaluate((src) => chrome.runtime.sendMessage({ type: 'qr-decode', payload: { src } }).then((r) => r.result), src);
  const cors = await viaSw(`${base}/qr/qr-upi.png?cors`);
  if (cors?.status !== 'ok' || !cors.text.startsWith('upi://pay')) fail(`SW decode (CORS) failed: ${JSON.stringify(cors)}`);
  const dataUrl = await ext.evaluate(async (u) => {
    const b = await (await fetch(u)).blob();
    return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  }, `${base}/qr/qr-feed.png?cors`);
  const data = await viaSw(dataUrl);
  if (data?.status !== 'ok' || !data.text.includes('aspida-demo.invalid')) fail(`SW decode (data:) failed: ${JSON.stringify(data)}`);
  const noImage = await viaSw(`${base}/index.html`);
  if (noImage?.status !== 'unsupported') fail(`SW decode of non-image should be unsupported: ${JSON.stringify(noImage)}`);
  const bad = await viaSw('javascript:alert(1)');
  if (bad?.status !== 'unsupported') fail('SW decode accepted a javascript: URL');
  await ext.close();

  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1000 });
  await page.goto(`${base}/qr.html`);
  await sleep(1200);

  const expect = async (sel, re) => {
    await page.mouse.move(2, 2);
    await page.$eval(sel, (e) => e.scrollIntoView({ block: 'center' }));
    await sleep(250);
    await page.hover(sel);
    try {
      return await waitFor(async () => {
        const t = await overlayText(page);
        return re.test(t) ? t : null;
      }, sel, 6000);
    } catch {
      fail(`QR hover ${sel}: expected ${re}, got "${await overlayText(page)}"`);
      return '';
    }
  };

  await expect('#qr-highrisk', /not opened.*paypa1\.test.*High risk/);
  await expect('#qr-feed', /malicious\.aspida-demo\.invalid.*Known malicious/);
  // Bare domain (no scheme): analysed as a site, shown exactly as encoded.
  const bare = await expect('#qr-bare', /not opened.*paypa1\.test\/login.*High risk/);
  if (/https:\/\/paypa1/.test(bare)) fail(`bare-domain QR should show the text as encoded: ${bare}`);
  // Domain inside text: neutral note plus the verdict for that host.
  await expect('#qr-textdomain', /Refund desk.*may open sbi-kyc-update\.test as a link.*Suspicious/);
  await expect('#qr-clean', /wikipedia\.org.*No known threats found/);
  await expect('#qr-upi', /UPI payment request.*sbi\.refund\.desk@okaxis/);
  await expect('#qr-canvas', /sbi-kyc-login\.test.*Suspicious/);
  // Cross-origin image (no CORS headers): decoded via the service worker.
  await expect('#qr-cross', /not opened.*paypa1\.test.*High risk/);

  // The decoded link was never navigated to.
  if (!page.url().endsWith('/qr.html')) fail(`QR page navigated away to ${page.url()}`);
  await page.close();
}
