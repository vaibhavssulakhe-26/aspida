// Options page. Settings go straight to storage via the platform wrapper;
// feeds, allowlist, stats and data clearing go through the service worker.
import { getSettings, updateSettings, getLocal, onLocalChanged } from '../../platform/storage.js';
import { send } from '../../platform/messaging.js';
import { manifestVersion } from '../../platform/browser.js';
import { t, setLanguage } from '../../config/strings/index.js';
import { step, offsets, wrapped } from './carousel.js';

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

// Static text in options.html carries data-i18n / data-i18n-label /
// data-i18n-placeholder keys.
function applyLanguage(lang) {
  const code = setLanguage(lang);
  document.documentElement.lang = code;
  for (const e of document.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  for (const e of document.querySelectorAll('[data-i18n-label]')) e.setAttribute('aria-label', t(e.dataset.i18nLabel));
  for (const e of document.querySelectorAll('[data-i18n-placeholder]')) e.placeholder = t(e.dataset.i18nPlaceholder);
  $('lang-hint').hidden = code === 'en';
  $('version').textContent = t('options.version', { v: manifestVersion() });
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === code));
  if (!clearArmed) $('clear').textContent = t('options.clear');
  showTheme();
}

for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => updateSettings({ uiLanguage: b.dataset.lang }));

// Theme: 'auto' follows the system; the button sets an explicit light/dark
// opposite to what is showing. The choice is the 'theme' setting; a copy in
// localStorage lets theme-boot.js apply it before first paint.
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let theme = 'auto';
const isDark = () => theme === 'dark' || (theme === 'auto' && darkQuery.matches);

function showTheme() {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  root.toggleAttribute('data-dark', isDark());
  const label = t(isDark() ? 'options.themeToLight' : 'options.themeToDark');
  $('theme').setAttribute('aria-label', label);
  $('theme').title = label;
  try {
    if (theme === 'auto') localStorage.removeItem('aspida-theme');
    else localStorage.setItem('aspida-theme', theme);
  } catch {
    // Cache only; the setting is what counts.
  }
}

function applyTheme(next) {
  theme = next;
  showTheme();
}

$('theme').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  applyTheme(next);
  updateSettings({ theme: next });
});
darkQuery.addEventListener('change', showTheme);

// Circular navbar. The selected tab is centred; the others sit at their loop
// offset (see carousel.js) and slide when the selection changes.
const tabs = [...document.querySelectorAll('[role="tab"]')];
const TAB_IDS = tabs.map((b) => b.dataset.tab);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let selected = -1;
let lastOffsets = null;
// Centre-to-centre distance from the middle, in slots, for each loop offset:
// the tabs are scaled (1.12 / 0.92 / 0.86), so equal steps would leave
// uneven gaps.
const SLOT_POSITION = [0, 1.02, 1.92, 2.79];
const slotPosition = (d) => Math.sign(d) * SLOT_POSITION[Math.min(Math.abs(d), SLOT_POSITION.length - 1)];

function reach() {
  return Number(getComputedStyle(document.querySelector('.carousel')).getPropertyValue('--reach')) || 2;
}

function layoutTabs(animate) {
  const n = tabs.length;
  const next = offsets(selected, n);
  const r = reach();
  const strip = $('tabs');
  strip.classList.toggle('no-anim', !animate || reducedMotion.matches);
  tabs.forEach((tab, i) => {
    const d = next[i];
    if (animate && lastOffsets && wrapped(lastOffsets[i], d, n)) {
      // Changes sides: jump (hidden) to just outside its new place, then slide in.
      tab.style.transition = 'none';
      tab.style.setProperty('--d', String(slotPosition(d + Math.sign(d))));
      tab.setAttribute('data-out', '');
      void tab.offsetWidth;
      tab.style.transition = '';
    }
    tab.style.setProperty('--d', String(slotPosition(d)));
    tab.dataset.dist = String(Math.abs(d));
    tab.toggleAttribute('data-out', Math.abs(d) > r);
  });
  lastOffsets = next;
}

function select(i, { focus = false, animate = true } = {}) {
  const n = tabs.length;
  i = step(i, 0, n);
  const changed = i !== selected;
  selected = i;
  tabs.forEach((tab, k) => {
    const on = k === i;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    const panel = $(tab.getAttribute('aria-controls'));
    if (on && panel.hidden) {
      panel.hidden = false;
      if (animate && !reducedMotion.matches) {
        panel.classList.remove('entering');
        void panel.offsetWidth;
        panel.classList.add('entering');
      }
    } else if (!on) panel.hidden = true;
  });
  layoutTabs(animate && changed);
  if (focus) tabs[i].focus();
  if (changed) history.replaceState(null, '', `#${TAB_IDS[i]}`);
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(i, { focus: true }));
  tab.addEventListener('keydown', (e) => {
    const n = tabs.length;
    let to = null;
    if (e.key === 'ArrowRight') to = step(selected, 1, n);
    else if (e.key === 'ArrowLeft') to = step(selected, -1, n);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    else if (e.key === 'Enter' || e.key === ' ') to = i;
    if (to === null) return;
    e.preventDefault();
    select(to, { focus: true });
  });
});
for (const p of document.querySelectorAll('[role="tabpanel"]')) p.addEventListener('animationend', () => p.classList.remove('entering'));
// The number of neighbours shown changes with the width.
matchMedia('(max-width: 640px)').addEventListener('change', () => layoutTabs(false));

// options.html#feeds etc. opens that section; About otherwise.
const fromHash = () => TAB_IDS.indexOf(location.hash.slice(1));
select(Math.max(fromHash(), 0), { animate: false });
addEventListener('hashchange', () => fromHash() >= 0 && select(fromHash()));

async function renderFeatures() {
  const s = await getSettings();
  $('features').replaceChildren(
    ...FEATURES.map((key) => {
      const input = el('input', { type: 'checkbox', checked: !!s[key], id: `f-${key}` });
      input.setAttribute('role', 'switch');
      input.addEventListener('change', () => updateSettings({ [key]: input.checked }));
      return el('div', { className: 'toggle' }, input, el('label', { htmlFor: `f-${key}`, textContent: t(`feature.${key}`) }), el('span', { className: 'desc', textContent: t(`feature.${key}.desc`) }));
    }),
  );
}

async function renderFeeds() {
  const [s, info] = await Promise.all([getSettings(), send('feed-status')]);
  if (!info) return;
  const rows = info.feeds.map((f) => {
    const st = info.status[f.id] || {};
    const on = el('input', { type: 'checkbox', checked: !!s.feeds[f.id], ariaLabel: t('options.enableFeed', { name: f.name }) });
    on.setAttribute('role', 'switch');
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
    const { uiLanguage, theme: stored } = await getSettings();
    if (stored !== theme) applyTheme(stored);
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
getSettings().then(({ uiLanguage, theme: stored }) => {
  theme = stored;
  shownLanguage = uiLanguage;
  applyLanguage(uiLanguage);
  renderAll();
});
