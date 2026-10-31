// Interstitial page. Shows the blocked URL as text (never a link), the
// verdict with evidence, and three choices. The URL is only navigated to
// if the user explicitly picks "Proceed anyway" or "Add site to allowlist".
import { send } from '../../platform/messaging.js';
import { closeCurrentTab } from '../../platform/browser.js';
import { getSettings, onSettingsChanged } from '../../platform/storage.js';
import { renderVerdict, renderReportPanel, VERDICT_CSS } from '../render.js';
import { copyText } from '../clipboard.js';
import { t, setLanguage } from '../../config/strings/index.js';

const target = new URLSearchParams(location.search).get('url') || '';
const isHttp = /^https?:\/\//i.test(target);

const style = document.createElement('style');
style.textContent = VERDICT_CSS;
document.head.append(style);
let verdict = null;
let reportOpen = false;
let reportEnabled = true;

// Static text carries data-i18n keys; re-run when the language setting changes.
function render(lang) {
  document.documentElement.lang = setLanguage(lang);
  for (const e of document.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  document.getElementById('target').textContent = target || t('warning.missingAddress');
  if (!verdict) return;
  const heading = { malicious: 'warning.headingMalicious', high: 'warning.headingHigh' }[verdict.tier];
  if (heading) document.getElementById('heading').textContent = t(heading);
  const report = reportEnabled ? { onOpen: () => ((reportOpen = true), renderReport(true)) } : null;
  document.getElementById('verdict').replaceChildren(renderVerdict(verdict, { mode: 'page', report }));
  renderReport(false);
}

// "Report this link": shown below the verdict; only opens a reporting site in
// a new tab (via the worker) or copies the URL, on click.
function renderReport(focus) {
  const box = document.getElementById('report');
  if (!reportOpen || !reportEnabled || !verdict) return box.replaceChildren();
  const panel = renderReportPanel(verdict, {
    copy: (text) => copyText(text),
    open: (dest, url) => send('open-report', { dest, target: url, tier: verdict.tier, signals: (verdict.reasons || []).map((r) => r.id) }).then((ok) => !!ok, () => false),
    close: () => {
      reportOpen = false;
      renderReport(false);
      document.querySelector('.tl-report-open')?.focus();
    },
  });
  box.replaceChildren(panel);
  if (focus) panel.querySelector('input, button')?.focus();
}

async function show() {
  const settings = await getSettings();
  reportEnabled = settings.reportButton !== false;
  render(settings.uiLanguage);
  onSettingsChanged((s) => {
    reportEnabled = s.reportButton !== false;
    render(s.uiLanguage);
  });
  if (!isHttp) return;
  verdict = await send('analyze-url', { url: target });
  render((await getSettings()).uiLanguage); // re-read: the language may have changed meanwhile
}

function goBack() {
  if (history.length > 1) history.back();
  else closeCurrentTab();
}

async function proceed() {
  if (!isHttp) return;
  await send('proceed', { url: target });
  location.replace(target);
}

document.getElementById('back').addEventListener('click', goBack);
document.getElementById('proceed').addEventListener('click', proceed);
document.getElementById('allow').addEventListener('click', async () => {
  if (!isHttp) return;
  await send('allowlist-add', { target });
  await proceed();
});
for (const id of ['proceed', 'allow']) document.getElementById(id).disabled = !isHttp;
show().catch((e) => console.warn('Aspida', e));
document.getElementById('back').focus();
