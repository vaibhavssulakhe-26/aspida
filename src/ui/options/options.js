// Options page. Settings go straight to storage via the platform wrapper;
// feeds, allowlist, stats and data clearing go through the service worker.
import { getSettings, updateSettings, getLocal, onLocalChanged } from '../../platform/storage.js';
import { send } from '../../platform/messaging.js';
import { manifestVersion } from '../../platform/browser.js';

const FEATURES = [
  ['hoverVerdict', 'Link hover verdict', 'Show a verdict tooltip when you hover a link on any web page.'],
  ['qrHover', 'QR code hover', 'Decode QR codes in images on hover and check the link inside, without opening it.'],
  ['navigationGuard', 'Warning page', 'Stop navigations to known-malicious sites (threat-feed matches) with a warning page.'],
  ['blockHighRisk', 'Warning page for High risk', 'Also stop navigations that local checks rate "High risk" (lookalike domains etc.).'],
  ['chatWhatsApp', 'WhatsApp Web', 'Badge risky links in WhatsApp Web chats.'],
  ['chatTelegram', 'Telegram Web', 'Badge risky links in Telegram Web chats.'],
  ['chatInstagram', 'Instagram DMs', 'Badge risky links in Instagram direct messages.'],
  ['gmailBanner', 'Gmail: opened email', 'Show a banner on an opened email with sender and link checks.'],
  ['gmailInboxHighlight', 'Gmail: inbox highlighting', 'Colour inbox rows yellow/red from the sender name and address shown in the list. Weak signal; off by default.'],
  ['debug', 'Debug logging', 'Log selector mismatches and timing to the page console (console.debug).'],
];

const STAT_LABELS = [
  ['suspicious', 'Suspicious seen'],
  ['high', 'High risk seen'],
  ['malicious', 'Known malicious seen'],
  ['blocked', 'Navigations stopped'],
  ['qrDecoded', 'QR codes decoded'],
];

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

function ago(ts) {
  if (!ts) return 'never';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

async function renderFeatures() {
  const s = await getSettings();
  $('features').replaceChildren(
    ...FEATURES.map(([key, label, desc]) => {
      const input = el('input', { type: 'checkbox', checked: !!s[key], id: `f-${key}` });
      input.addEventListener('change', () => updateSettings({ [key]: input.checked }));
      return el('div', { className: 'toggle' }, input, el('label', { htmlFor: `f-${key}`, textContent: label }), el('span', { className: 'desc', textContent: desc }));
    }),
  );
  $('urlhaus-key').value = s.urlhausAuthKey || '';
}

async function renderFeeds() {
  const [s, info] = await Promise.all([getSettings(), send('feed-status')]);
  if (!info) return;
  const rows = info.feeds.map((f) => {
    const st = info.status[f.id] || {};
    const on = el('input', { type: 'checkbox', checked: !!s.feeds[f.id], ariaLabel: `Enable ${f.name}` });
    on.addEventListener('change', () => updateSettings({ feeds: { [f.id]: on.checked } }));
    const status = el('td');
    if (!s.feeds[f.id]) status.append(el('span', { className: 'small', textContent: 'Off' }));
    else {
      status.append(el('div', { textContent: st.lastSuccess ? `Updated ${ago(st.lastSuccess)}` : 'Not downloaded yet', className: st.lastSuccess ? 'okc' : '' }));
      if (st.error) status.append(el('div', { className: 'err', textContent: `Last attempt failed: ${st.error}${st.lastSuccess ? ' (keeping last good copy)' : ''}` }));
    }
    const refresh = el('button', { type: 'button', textContent: 'Refresh', disabled: !s.feeds[f.id] });
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      refresh.textContent = 'Refreshing…';
      try {
        await send('feed-refresh', { id: f.id });
      } finally {
        renderFeeds();
      }
    });
    const count = st.activeGen ? `${(st.urls || 0).toLocaleString()} URLs, ${(st.hosts || 0).toLocaleString()} hosts` : '–';
    return el('tr', {}, el('td', {}, on), el('td', {}, el('div', { textContent: f.name }), el('div', { className: 'small', textContent: f.license })), status, el('td', { className: 'num', textContent: count }), el('td', {}, refresh));
  });
  $('feeds').tBodies[0].replaceChildren(...rows);
}

async function renderAllowlist() {
  const list = await getLocal('allowlist', []);
  $('allowlist').replaceChildren(
    ...(list.length
      ? list.map((d) => {
          const rm = el('button', { type: 'button', textContent: '×', ariaLabel: `Remove ${d}` });
          rm.addEventListener('click', () => send('allowlist-remove', { domain: d }));
          return el('li', {}, el('span', { textContent: d }), rm);
        })
      : [el('li', { className: 'small', textContent: 'Empty' })]),
  );
}

async function renderStats() {
  const stats = (await send('stats')) || {};
  $('stats').replaceChildren(...STAT_LABELS.map(([k, label]) => el('div', {}, el('dt', { textContent: label }), el('dd', { textContent: String(stats[k] || 0) }))));
}

$('urlhaus-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await updateSettings({ urlhausAuthKey: $('urlhaus-key').value.trim() });
});

$('allow-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('allow-input').value.trim();
  if (!v) return;
  await send('allowlist-add', { target: v.includes('://') ? v : `https://${v}/` });
  $('allow-input').value = '';
});

let clearArmed = false;
$('clear').addEventListener('click', async () => {
  if (!clearArmed) {
    clearArmed = true;
    $('clear').textContent = 'Click again to confirm';
    $('clear-msg').textContent = '';
    setTimeout(() => {
      clearArmed = false;
      $('clear').textContent = 'Clear all data';
    }, 5000);
    return;
  }
  clearArmed = false;
  $('clear').disabled = true;
  $('clear-msg').textContent = 'Clearing…';
  await send('clear-all');
  $('clear').disabled = false;
  $('clear').textContent = 'Clear all data';
  $('clear-msg').textContent = 'All data cleared.';
  renderAll();
});

function renderAll() {
  return Promise.all([renderFeatures(), renderFeeds(), renderAllowlist(), renderStats()]);
}

$('version').textContent = `Version ${manifestVersion()}.`;
onLocalChanged((keys) => {
  if (keys.some((k) => k.startsWith('feedStatus:')) || keys.includes('settings')) renderFeeds();
  if (keys.includes('allowlist')) renderAllowlist();
  if (keys.includes('stats')) renderStats();
});
renderAll();
