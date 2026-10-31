// Opened email (demo mailbox): Minimize -> pill (remembered for the session),
// "Report sender", inline "Report" after flagged links, confirm steps opening
// destinations only via the worker (chrome.tabs.create stubbed, so nothing is
// loaded), and the reportButton switch.
import { sleep, waitFor, aspidaShadows, overlayText, setSetting } from './helpers.mjs';

// Centre of the first element in any of Aspida's (closed) shadow roots whose
// class list has cls and whose text matches re.
async function shadowPoint(page, cls, re = /./) {
  const cdp = await page.createCDPSession();
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const hits = [];
    const walk = (n) => {
      const attrs = n.attributes || [];
      for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'class' && attrs[i + 1].split(/\s+/).includes(cls)) hits.push(n.nodeId);
      for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) walk(c);
    };
    walk(root);
    for (const nodeId of hits) {
      const { outerHTML } = await cdp.send('DOM.getOuterHTML', { nodeId });
      if (!re.test(outerHTML.replace(/<[^>]+>/g, ' '))) continue;
      const { model } = await cdp.send('DOM.getBoxModel', { nodeId }).catch(() => ({}));
      if (!model) continue;
      const [x1, y1, , , x3, y3] = model.border;
      return { x: (x1 + x3) / 2, y: (y1 + y3) / 2 };
    }
    return null;
  } finally {
    await cdp.detach();
  }
}

export default async function ({ browser, worker, base, extId, fail }) {
  await worker.evaluate(() => {
    self.__opened = [];
    chrome.tabs.create = async (props) => {
      self.__opened.push(props.url);
      return { id: -1 };
    };
  });
  const opened = () => worker.evaluate(() => self.__opened.splice(0));
  await browser.defaultBrowserContext().overridePermissions(base, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await setSetting(browser, extId, { reportButton: true, gmailBanner: true });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  const banner = async () => (await aspidaShadows(page)).find((s) => s.kind === 'banner')?.text || '';
  const inline = async () => (await aspidaShadows(page)).filter((s) => s.kind === 'badge' && /tl-inline-report/.test(s.html));
  const click = async (cls, re, what) => {
    const p = await shadowPoint(page, cls, re);
    if (!p) return fail(`email: no ${what}`), false;
    await page.mouse.click(p.x, p.y);
    return true;
  };
  // Fresh load each time (same-URL navigation would only change the hash).
  const open = async (hash) => {
    await page.goto('about:blank');
    await page.goto(`${base}/mail.html#${hash}`);
    await waitFor(async () => /Aspida:|, show/.test(await banner()), `banner on ${hash}`, 15000).catch(() => fail(`no banner on mail.html#${hash}`));
  };

  // High-risk email: buttons present.
  await open('kyc');
  let text = await banner();
  for (const want of ['Minimize', 'Report sender', 'Report this link']) if (!text.includes(want)) fail(`KYC banner lacks "${want}": ${text}`);
  if (/this is phishing|\bsafe\b/i.test(text)) fail(`banner wording: ${text}`);
  if ((await inline()).length !== 1) fail(`expected one inline Report button on the KYC email, got ${(await inline()).length}`);
  const layout = await page.$eval('#link-kyc', (a) => ({ top: a.getBoundingClientRect().top, next: a.nextSibling?.nodeName }));
  if (layout.next !== 'SPAN') fail(`inline Report not placed right after the link: ${JSON.stringify(layout)}`);

  // Report sender: address, copy, 1930, destination opens a tab via the worker.
  await click('tl-report-open', /Report sender/, '"Report sender" button');
  await waitFor(async () => /Copy address/.test(await overlayText(page)), 'sender report step', 4000).catch(() => {});
  let step = await overlayText(page);
  if (!/kyc-alerts@secure-notice\.test/.test(step) || !/Copy address/.test(step) || !/1930/.test(step) || !/Report as suspicious/.test(step)) fail(`sender report step: ${step}`);
  await click('tl-report-dest', /Netcraft/, 'Netcraft button');
  await sleep(500);
  let tabs = await opened();
  if (tabs.join() !== 'https://report.netcraft.com/report') fail(`sender report opened ${JSON.stringify(tabs)}`);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (clip !== 'kyc-alerts@secure-notice.test') fail(`sender address not copied: "${clip}"`);
  await page.keyboard.press('Escape');
  await sleep(200);
  if (await overlayText(page)) fail('Escape did not close the sender report step');

  // Inline Report after the flagged link: same confirm step as the tooltip.
  await click('tl-inline-report', /Report/, 'inline Report button');
  await waitFor(async () => /Copy URL/.test(await overlayText(page)), 'link report step', 4000).catch(() => {});
  step = await overlayText(page);
  if (!/onlinesbi-kyc\.test\/verify/.test(step) || !/Remove query string/.test(step)) fail(`inline link report step: ${step}`);
  await click('tl-report-dest', /Google Safe Browsing/, 'Safe Browsing button');
  await sleep(500);
  tabs = await opened();
  if (!tabs[0]?.startsWith('https://safebrowsing.google.com/safebrowsing/report_phish/?url=https%3A%2F%2Fonlinesbi-kyc.test%2Fverify')) fail(`inline report opened ${JSON.stringify(tabs)}`);
  await page.mouse.click(5, 5);
  await sleep(200);
  if (await overlayText(page)) fail('click elsewhere did not close the report step');

  // Minimize -> pill; remembered on reload; expand again.
  await click('tl-minimize', /Minimize/, 'Minimize button');
  await sleep(300);
  text = await banner();
  if (!/High risk, show/.test(text) || /Report sender/.test(text)) fail(`minimized banner: ${text}`);
  await open('kyc');
  await sleep(300);
  if (!/High risk, show/.test(await banner())) fail('minimized state not remembered on reload');
  if ((await open('parcel'), /, show/.test(await banner()))) fail('minimize leaked to another email');
  await open('kyc');
  await click('tl-pill', /show/, 'pill');
  await sleep(300);
  if (!/Minimize/.test(await banner())) fail('pill did not expand the banner');
  await open('kyc');
  if (!/Minimize/.test(await banner())) fail('expanded state not remembered');

  // No-warning email: calm wording, no Minimize, no inline buttons, only
  // "Think this is suspicious? Report", which opens the sender step with a
  // picker of the email's links.
  await open('meeting');
  text = await banner();
  if (/Minimize|Report sender|Report this link/.test(text) || (await inline()).length) fail(`clean email has warning-only buttons: ${text}`);
  if (!/No known threats found/.test(text) || !/Think this is suspicious\? Report/.test(text) || /\bsafe\b|phishing/i.test(text)) fail(`clean email banner: ${text}`);
  await click('tl-report-missed', /Report/, '"Think this is suspicious? Report"');
  await waitFor(async () => /Copy address/.test(await overlayText(page)), 'missed report step', 4000).catch(() => {});
  step = await overlayText(page);
  if (!/Report as suspicious/.test(step) || !/ananya\.rao@northwind\.example/.test(step) || !/Links in this email/.test(step)) fail(`missed report step: ${step}`);
  if (!/wiki\.northwind\.example\/planning\/q4-notes/.test(step) || !/calendar\.northwind\.example\/event\/2291/.test(step)) fail(`missed report step lacks the email's links: ${step}`);
  await click('tl-report-linkcopy', /Copy URL/, 'link picker Copy URL');
  await sleep(300);
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (copied !== 'https://wiki.northwind.example/planning/q4-notes') fail(`picker Copy URL copied "${copied}"`);
  await click('tl-report-dest', /cybercrime/, 'cybercrime.gov.in button');
  await sleep(500);
  tabs = await opened();
  if (tabs.join() !== 'https://cybercrime.gov.in/') fail(`missed report opened ${JSON.stringify(tabs)}`);
  await page.keyboard.press('Escape');

  // Switch off: report buttons gone live, minimize stays.
  await open('kyc');
  await setSetting(browser, extId, { reportButton: false });
  await waitFor(async () => !/Report sender/.test(await banner()) && /Minimize/.test(await banner()), 'report buttons removed', 6000).catch(async () => fail(`report buttons still shown when off: ${await banner()}`));
  if ((await inline()).length) fail('inline Report still shown when the switch is off');
  await open('order');
  if (/Think this is suspicious/.test(await banner())) fail('"Think this is suspicious? Report" shown with the switch off');
  await setSetting(browser, extId, { reportButton: true });

  // The settings-page theme reaches in-page UI too (banner re-rendered live).
  await setSetting(browser, extId, { theme: 'dark' });
  const themed = async () => (await aspidaShadows(page)).find((s) => s.kind === 'banner')?.html || '';
  await waitFor(async () => /class="tl-verdict[^"]*"[^>]*data-theme="dark"/.test(await themed()), 'dark banner', 6000).catch(() => fail('banner ignores theme=dark'));
  await setSetting(browser, extId, { theme: 'auto' });
  await page.close();
}
