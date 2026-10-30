// Interstitial page. Shows the blocked URL as text (never a link), the
// verdict with evidence, and three choices. The URL is only navigated to
// if the user explicitly picks "Proceed anyway" or "Add site to allowlist".
import { send } from '../../platform/messaging.js';
import { closeCurrentTab } from '../../platform/browser.js';
import { renderVerdict, VERDICT_CSS } from '../render.js';

const target = new URLSearchParams(location.search).get('url') || '';
const isHttp = /^https?:\/\//i.test(target);

const style = document.createElement('style');
style.textContent = VERDICT_CSS;
document.head.append(style);
document.getElementById('target').textContent = target || '(missing address)';

async function show() {
  if (!isHttp) return;
  const verdict = await send('analyze-url', { url: target });
  if (!verdict) return;
  if (verdict.tier === 'malicious') document.getElementById('heading').textContent = 'Known malicious site blocked';
  else if (verdict.tier === 'high') document.getElementById('heading').textContent = 'High-risk site stopped';
  document.getElementById('verdict').replaceChildren(renderVerdict(verdict, { mode: 'page' }));
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
show().catch((e) => console.warn('TrustLens', e));
document.getElementById('back').focus();
