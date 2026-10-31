// Options page. Settings go straight to storage via the platform wrapper;
// feeds, allowlist, stats and data clearing go through the service worker.
import { getSettings, updateSettings, getLocal, onLocalChanged } from '../../platform/storage.js';
import { send } from '../../platform/messaging.js';
import { manifestVersion } from '../../platform/browser.js';
import { t, setLanguage, LANGUAGES } from '../../config/strings/index.js';

// Feature switches in display order. Labels and descriptions are the
// 'feature.<key>' and 'feature.<key>.desc' strings.
const FEATURES = [
  'hoverVerdict',
  'qrHover',
  'navigationGuard',
  'blockHighRisk',
  'toolbarIcon',
  'softwareChecks',
  'reportButton',
  'chatWhatsApp',
  'chatTelegram',
  'chatInstagram',
  'chatInlineBadges',
  'gmailBanner',
  'gmailInboxHighlight',
  'debug',
];

const STATS = ['suspicious', 'high', 'malicious', 'blocked', 'qrDecoded'];

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

function ago(ts) {
  if (!ts) return t('ago.never');
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return t('ago.now');
  if (m < 60) return t('ago.minutes', { n: m });
  const h = Math.round(m / 60);
  return h < 48 ? t('ago.hours', { n: h }) : t('ago.days', { n: Math.round(h / 24) });
}

// Static text in options.html carries data-i18n / data-i18n-placeholder keys.
function applyLanguage(lang) {
  const code = setLanguage(lang);
  document.documentElement.lang = code;
  for (const e of document.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  for (const e of document.querySelectorAll('[data-i18n-placeholder]')) e.placeholder = t(e.dataset.i18nPlaceholder);
  $('lang-hint').hidden = code === 'en';
  $('version').textContent = t('options.version', { v: manifestVersion() });
  $('ui-language').value = code;
  if (!clearArmed) $('clear').textContent = t('options.clear');
}

$('ui-language').replaceChildren(...LANGUAGES.map(({ code, name }) => el('option', { value: code, textContent: name, lang: code })));
$('ui-language').addEventListener('change', () => updateSettings({ uiLanguage: $('ui-language').value }));

async function renderFeatures() {
  const s = await getSettings();
  $('features').replaceChildren(
    ...FEATURES.map((key) => {
      const input = el('input', { type: 'checkbox', checked: !!s[key], id: `f-${key}` });
      input.addEventListener('change', () => updateSettings({ [key]: input.checked }));
      return el('div', { className: 'toggle' }, input, el('label', { htmlFor: `f-${key}`, textContent: t(`feature.${key}`) }), el('span', { className: 'desc', textContent: t(`feature.${key}.desc`) }));
    }),
  );
  $('urlhaus-key').value = s.urlhausAuthKey || '';
}

async function renderFeeds() {
  const [s, info] = await Promise.all([getSettings(), send('feed-status')]);
  if (!info) return;
  const rows = info.feeds.map((f) => {
    const st = info.status[f.id] || {};
    const on = el('input', { type: 'checkbox', checked: !!s.feeds[f.id], ariaLabel: t('options.enableFeed', { name: f.name }) });
    on.addEventListener('change', () => updateSettings({ feeds: { [f.id]: on.checked } }));
    const status = el('td');
    if (!s.feeds[f.id]) status.append(el('span', { className: 'small', textContent: t('options.feedOff') }));
    else {
      status.append(el('div', { textContent: st.lastSuccess ? t('options.updated', { ago: ago(st.lastSuccess) }) : t('options.notDownloaded'), className: st.lastSuccess ? 'okc' : '' }));
      if (st.error) status.append(el('div', { className: 'err', textContent: `${t('options.lastFailed', { error: st.error })}${st.lastSuccess ? ` ${t('options.keepingLast')}` : ''}` }));
    }
    const refresh = el('button', { type: 'button', textContent: t('options.refresh'), disabled: !s.feeds[f.id] });
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      refresh.textContent = t('options.refreshing');
      try {
        await send('feed-refresh', { id: f.id });
      } finally {
        renderFeeds();
      }
    });
    const count = st.activeGen ? t('options.entries', { urls: (st.urls || 0).toLocaleString(), hosts: (st.hosts || 0).toLocaleString() }) : '–';
    return el('tr', {}, el('td', {}, on), el('td', {}, el('div', { textContent: f.name }), el('div', { className: 'small', textContent: f.license })), status, el('td', { className: 'num', textContent: count }), el('td', {}, refresh));
  });
  $('feeds').tBodies[0].replaceChildren(...rows);
}

async function renderAllowlist() {
  const list = await getLocal('allowlist', []);
  $('allowlist').replaceChildren(
    ...(list.length
      ? list.map((d) => {
          const rm = el('button', { type: 'button', textContent: '×', ariaLabel: t('options.remove', { d }) });
          rm.addEventListener('click', () => send('allowlist-remove', { domain: d }));
          return el('li', {}, el('span', { textContent: d }), rm);
        })
      : [el('li', { className: 'small', textContent: t('options.empty') })]),
  );
}

async function renderStats() {
  const stats = (await send('stats')) || {};
  $('stats').replaceChildren(...STATS.map((k) => el('div', {}, el('dt', { textContent: t(`stat.${k}`) }), el('dd', { textContent: String(stats[k] || 0) }))));
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
    $('clear').textContent = t('options.clearConfirm');
    $('clear-msg').textContent = '';
    setTimeout(() => {
      clearArmed = false;
      $('clear').textContent = t('options.clear');
    }, 5000);
    return;
  }
  clearArmed = false;
  $('clear').disabled = true;
  $('clear-msg').textContent = t('options.clearing');
  await send('clear-all');
  $('clear').disabled = false;
  $('clear').textContent = t('options.clear');
  $('clear-msg').textContent = t('options.cleared');
  renderAll();
});

function renderAll() {
  return Promise.all([renderFeatures(), renderFeeds(), renderAllowlist(), renderStats()]);
}

let shownLanguage = null;
onLocalChanged(async (keys) => {
  if (keys.includes('settings')) {
    const { uiLanguage } = await getSettings();
    if (uiLanguage !== shownLanguage) {
      shownLanguage = uiLanguage;
      applyLanguage(uiLanguage);
      renderAll();
      return;
    }
  }
  if (keys.some((k) => k.startsWith('feedStatus:')) || keys.includes('settings')) renderFeeds();
  if (keys.includes('allowlist')) renderAllowlist();
  if (keys.includes('stats')) renderStats();
});
getSettings().then(({ uiLanguage }) => {
  shownLanguage = uiLanguage;
  applyLanguage(uiLanguage);
  renderAll();
});
