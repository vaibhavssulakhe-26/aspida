// Loads the unpacked extension in Chrome for Testing and fails on any error:
// extension errors on chrome://extensions, service-worker exceptions, and
// page console errors on the demo pages. Optional dev tool, not shipped.
//
//   CHROME_PATH=/path/to/chrome-for-testing npm run smoke
//
// (Branded Chrome ignores --load-extension since v137; use Chrome for
// Testing: npx @puppeteer/browsers install chrome@stable)
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createDemoServer } from './demo-server.mjs';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const chromePath = process.env.CHROME_PATH;
if (!chromePath || !existsSync(chromePath)) {
  console.error('Set CHROME_PATH to a Chrome for Testing binary.');
  process.exit(2);
}

const failures = [];
const fail = (msg) => failures.push(msg);

// Serve demo/ on loopback so content scripts (http/https only) run on it.
const server = createDemoServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  pipe: true,
  enableExtensions: [root],
  args: ['--no-sandbox'],
});

// Privacy audit: every network request made by pages and the extension's
// worker. Anything not on this list fails the run. In particular, no request
// may go to a link/QR target that was only hovered or scanned.
const requests = [];
const ALLOWED_REQUESTS = [
  /^chrome-extension:\/\//,
  /^data:/,
  /^blob:/,
  /^http:\/\/(127\.0\.0\.1|localhost):\d+\//, // demo server
  /^http:\/\/[a-z0-9-]+\.localhost:\d+\//, // demo server under *.localhost names (toolbar icon demo)
  /^https:\/\/raw\.githubusercontent\.com\/(openphish|Phishing-Database)\//, // feeds
  /^https:\/\/raw\.githubusercontent\.com\/hagezi\/dns-blocklists\/main\/wildcard\/anti\.piracy-onlydomains\.txt$/, // pirated-software list
  /^https:\/\/openphish\.com\//,
  /^https:\/\/urlhaus-api\.abuse\.ch\//,
  // Deliberate navigations made by step 01 (typed-URL / "Proceed anyway" tests):
  /^http:\/\/malicious\.aspida-demo\.invalid\/login$/,
  /^http:\/\/paypa1\.aspida-demo\.invalid\/$/,
  /^https:\/\/paypa1\.test\/signin$/,
  /^https:\/\/crackzone-downloads\.test\/$/, // step 09: piracy-listed site is not intercepted
  /^chrome:\/\//,
  /^about:/,
];

// Every page/tab: collect uncaught exceptions and console errors.
// Network failures for the reserved demo TLDs are expected and ignored.
const IGNORED = [/ERR_NAME_NOT_RESOLVED/, /aspida-demo\.invalid/, /phish-demo\.test/, /favicon\.ico/];
browser.on('targetcreated', async (t) => {
  if (t.type() !== 'page') return;
  const p = await t.page().catch(() => null);
  if (!p) return;
  p.on('request', (r) => requests.push({ url: r.url(), from: `page ${p.url()}` }));
  p.on('pageerror', (e) => fail(`page error on ${p.url()}: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = `${m.text()} ${m.location()?.url || ''}`;
    if (!IGNORED.some((r) => r.test(text))) fail(`page console error on ${p.url()}: ${text}`);
  });
});

try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('service-worker.js'), { timeout: 15000 });
  const extId = new URL(swTarget.url()).host;
  const worker = await swTarget.worker();
  worker.on('console', (m) => m.type() === 'error' && fail(`SW console: ${m.text()}`));
  await worker.client.send('Network.enable');
  worker.client.on('Network.requestWillBeSent', (e) => requests.push({ url: e.request.url, from: 'service worker' }));
  worker.client.on('Runtime.exceptionThrown', (e) => fail(`SW exception: ${e.exceptionDetails.exception?.description || e.exceptionDetails.text}`));
  console.log(`extension ${extId} loaded`);

  // Optional per-milestone hooks live in tools/smoke-steps/*.mjs.
  const { readdir } = await import('node:fs/promises');
  const stepsDir = path.join(root, 'tools', 'smoke-steps');
  const steps = existsSync(stepsDir) ? (await readdir(stepsDir)).filter((f) => /^\d+-.*\.mjs$/.test(f)).sort() : [];
  for (const f of steps) {
    const mod = await import(path.join(stepsDir, f));
    console.log(`step ${f}`);
    try {
      await mod.default({ browser, worker, extId, base, fail });
    } catch (e) {
      fail(`${f}: ${e.stack || e}`);
    }
  }

  // Privacy audit result.
  const unexpected = requests.filter((r) => !ALLOWED_REQUESTS.some((re) => re.test(r.url)));
  for (const r of unexpected) fail(`unexpected network request to ${r.url} (from ${r.from})`);
  console.log(`privacy audit: ${requests.length} requests checked, ${unexpected.length} unexpected`);

  // Finally: chrome://extensions must show no errors for us.
  const page = await browser.newPage();
  await page.goto('chrome://extensions/');
  await new Promise((r) => setTimeout(r, 500));
  const errInfo = await page.evaluate(async (id) => {
    const errs = await new Promise((r) => chrome.developerPrivate.getExtensionInfo(id, r));
    return { manifestErrors: errs.manifestErrors.map((e) => e.message), runtimeErrors: errs.runtimeErrors.map((e) => `${e.message} @ ${e.source}`), warnings: errs.installWarnings };
  }, extId);
  for (const e of errInfo.manifestErrors) fail(`manifest error: ${e}`);
  for (const e of errInfo.runtimeErrors) fail(`runtime error: ${e}`);
  for (const w of errInfo.warnings) fail(`install warning: ${w}`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`SMOKE FAILED (${failures.length}):\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('SMOKE OK: extension loads with no errors');
