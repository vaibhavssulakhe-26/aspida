// Options page. Settings go straight to storage via the platform wrapper;
// feeds, allowlist, stats and data clearing go through the service worker.
import { getSettings, updateSettings, getLocal, onLocalChanged } from '../../platform/storage.js';
import { send } from '../../platform/messaging.js';
import { manifestVersion } from '../../platform/browser.js';
import { t, setLanguage } from '../../config/strings/index.js';
import { step } from './carousel.js';
import { createIdleMode, SLIDES } from '../../core/idle-mode.js';
import {
  loopDistance, wrapPosition, advance, clampDt, scaleFor, highlightFor, labelFor, opacityFor, slotX, targetFor, nearestItem,
  easeOutCubic, easeInQuad, CENTRE_EASE_MS, RESUME_EASE_MS,
} from '../../core/belt.js';

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
  for (const tab of document.querySelectorAll('[role="tab"]')) tab.dataset.label = tab.textContent; // highlight layer text
  for (const e of document.querySelectorAll('[data-i18n-label]')) e.setAttribute('aria-label', t(e.dataset.i18nLabel));
  for (const e of document.querySelectorAll('[data-i18n-placeholder]')) e.placeholder = t(e.dataset.i18nPlaceholder);
  $('lang-hint').hidden = code === 'en';
  $('version').textContent = t('options.version', { v: manifestVersion() });
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === code));
  if (!clearArmed) $('clear').textContent = t('options.clear');
  slideAlts();
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

// Circular navbar, moved like a conveyor (see src/core/belt.js). One
// position value places every tab; in idle mode a single animation-frame
// loop advances it by elapsed time. Per frame only transform, opacity and
// --hl (the highlight layer's opacity) are written; no layout is read.
const tabs = [...document.querySelectorAll('[role="tab"]')];
const TAB_IDS = tabs.map((b) => b.dataset.tab);
const N = tabs.length;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
for (const tab of tabs) tab.dataset.label = tab.textContent; // text of the highlight layer (::after)
const belt = { p: 0, raf: 0, last: 0, running: false, rampStart: 0, ease: null, slotPx: 152, reach: 2, centreIdx: -1 };

// Layout reads happen here only (start-up and width changes), never per frame.
// Tabs are drawn 1.12 x (slot - 12px) wide (see options.css).
function measureBelt() {
  belt.slotPx = tabs[0].offsetWidth / 1.12 + 12;
  belt.reach = Number(getComputedStyle(document.querySelector('.carousel')).getPropertyValue('--reach')) || 2;
}

function renderBelt() {
  const { p, slotPx, reach } = belt;
  tabs.forEach((tab, i) => {
    const d = loopDistance(i, p, N);
    const o = opacityFor(d, reach);
    tab.style.transform = `translateX(${(slotX(d) * slotPx).toFixed(2)}px) scale(${scaleFor(d).toFixed(4)})`;
    tab.style.opacity = o.toFixed(3);
    tab.style.setProperty('--hl', highlightFor(d).toFixed(3));
    tab.style.setProperty('--hl-text', labelFor(d).toFixed(3));
    tab.toggleAttribute('data-out', o < 0.02);
  });
  const c = nearestItem(p, N);
  if (c !== belt.centreIdx) {
    belt.centreIdx = c;
    tabs.forEach((tab, k) => {
      tab.tabIndex = k === c ? 0 : -1;
      tab.toggleAttribute('data-centre', k === c); // aria-selected only in active mode
    });
  }
}

function frame(ts) {
  belt.raf = 0;
  const dt = belt.last ? clampDt(ts - belt.last) : 0;
  belt.last = ts;
  const e = belt.ease;
  if (e) {
    const t = (ts - (e.start ??= ts)) / CENTRE_EASE_MS;
    belt.p = e.from + (e.to - e.from) * easeOutCubic(t);
    if (t >= 1) {
      belt.p = wrapPosition(e.to, N);
      belt.ease = null;
      renderBelt();
      stopLoop();
      e.done();
      return;
    }
  } else if (belt.running) {
    belt.p = advance(belt.p, dt, N, easeInQuad((ts - (belt.rampStart ||= ts)) / RESUME_EASE_MS));
  } else {
    return stopLoop();
  }
  renderBelt();
  belt.raf = requestAnimationFrame(frame);
}

function startLoop() {
  if (belt.raf || document.visibilityState === 'hidden') return;
  belt.last = 0; // first frame moves nothing: no jump after a pause
  $('tabs').classList.add('moving');
  belt.raf = requestAnimationFrame(frame);
}

function stopLoop() {
  if (belt.raf) cancelAnimationFrame(belt.raf);
  belt.raf = 0;
  $('tabs').classList.remove('moving');
}

// Idle mode: continuous motion, ramping up from a standstill. Reduced
// motion: stays still with the current item centred.
function startMotion() {
  belt.ease = null;
  if (reducedMotion.matches) {
    belt.running = false;
    stopLoop();
    belt.p = wrapPosition(Math.round(belt.p), N);
    renderBelt();
    return;
  }
  belt.running = true;
  belt.rampStart = 0;
  startLoop();
}

function stopMotion() {
  belt.running = false;
  if (!belt.ease) stopLoop();
}

// Stop and bring item i to the exact centre along the shortest path (eased),
// then call done.
function centreOn(i, done) {
  belt.running = false;
  const to = targetFor(i, belt.p, N);
  if (reducedMotion.matches || Math.abs(to - belt.p) < 1e-3) {
    belt.ease = null;
    stopLoop();
    belt.p = wrapPosition(to, N);
    renderBelt();
    done();
    return;
  }
  belt.ease = { from: belt.p, to, start: null, done };
  startLoop();
}

// Show section i (active mode), or none (idle mode: no tab is selected, every
// tabpanel is hidden).
let shown = null;
function showSection(i, { animate = true } = {}) {
  const fade = (node) => {
    if (!animate || reducedMotion.matches) return;
    node.classList.remove('entering');
    void node.offsetWidth;
    node.classList.add('entering');
  };
  tabs.forEach((tab, k) => {
    const on = k === i;
    tab.setAttribute('aria-selected', String(on));
    const panel = $(tab.getAttribute('aria-controls'));
    if (on && panel.hidden) {
      panel.hidden = false;
      fade(panel);
    } else if (!on) panel.hidden = true;
  });
  const content = $('content');
  const wasHidden = content.hidden;
  content.hidden = i === null;
  if (i !== null && wasHidden) fade(content);
  shown = i;
  history.replaceState(null, '', i === null ? location.pathname + location.search : `#${TAB_IDS[i]}`);
}

// ---- Idle mode: moving navbar + slideshow until a section is chosen ----
// Slides come from slides/slides.json (written by `npm run slides`); if it is
// missing or empty there is simply no slideshow. Each slideN.png may have a
// caption string 'slides.captionN'; without one, no caption is shown.
const slideshow = { box: $('slideshow'), imgs: [], nums: [], captions: [], dots: [], index: 0 };
slideshow.box.style.setProperty('--slide-fade', `${SLIDES.fadeMs}ms`);

// Cross-fade: the new slide fades in on top while the previous one stays
// fully visible underneath, so the picture never dims to the background.
// Its caption fades in as the old caption fades out; the dots follow.
function showSlide(k, { fade = true } = {}) {
  const { imgs } = slideshow;
  if (!imgs.length) return;
  const prev = slideshow.index;
  slideshow.index = ((k % imgs.length) + imgs.length) % imgs.length;
  imgs.forEach((img, j) => {
    const on = j === slideshow.index;
    img.classList.toggle('on', on);
    img.classList.toggle('prev', fade && j === prev && !on);
    img.setAttribute('aria-hidden', String(!on));
    slideshow.captions[j].classList.toggle('on', on);
    slideshow.captions[j].setAttribute('aria-hidden', String(!on));
    slideshow.dots[j].classList.toggle('on', on);
  });
}

// Alt text and captions in the current language.
function slideAlts() {
  const m = slideshow.imgs.length;
  slideshow.imgs.forEach((img, j) => (img.alt = t('options.slideAlt', { n: j + 1, m })));
  slideshow.captions.forEach((cap, j) => {
    const key = `slides.caption${slideshow.nums[j]}`;
    const text = t(key);
    cap.textContent = text === key ? '' : text;
  });
}

async function loadSlides() {
  let names = [];
  try {
    const res = await fetch('../../../slides/slides.json', { cache: 'no-store' });
    if (res.ok) names = await res.json();
  } catch {
    names = [];
  }
  names = Array.isArray(names) ? names.filter((f) => typeof f === 'string' && /^slide\d+\.png$/i.test(f)) : [];
  // Preload all images before showing any, so nothing flashes; files that
  // fail to load are dropped.
  const loaded = await Promise.all(
    names.map(async (f) => {
      const img = el('img', { src: `../../../slides/${f}`, decoding: 'async', draggable: false });
      try {
        await img.decode();
        return img;
      } catch {
        return null;
      }
    }),
  );
  const kept = names.map((f, j) => [f, loaded[j]]).filter(([, img]) => img);
  slideshow.imgs = kept.map(([, img]) => img);
  slideshow.nums = kept.map(([f]) => Number(/\d+/.exec(f)[0]));
  slideshow.captions = kept.map(() => el('p', { className: 'slide-caption' }));
  slideshow.dots = kept.map(() => el('span'));
  slideAlts();
  $('slides').replaceChildren(...slideshow.imgs);
  $('slide-captions').replaceChildren(...slideshow.captions);
  $('slide-dots').replaceChildren(...slideshow.dots);
  showSlide(0, { fade: false });
  if (idle.mode === 'idle') slideshow.box.hidden = !slideshow.imgs.length;
}

// While someone types in a text field of the shown section, don't snap back
// to idle (checked again when the field loses focus). Remove this one
// condition to drop the exception.
function isEditingInContent() {
  const a = document.activeElement;
  return !!a && $('content').contains(a) && a.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select');
}

const idle = createIdleMode({
  isEditing: isEditingInContent,
  onIdle: () => {
    showSection(null, { animate: false });
    showSlide(0, { fade: false });
    startMotion();
    const box = slideshow.box;
    box.hidden = !slideshow.imgs.length;
    if (!box.hidden && !reducedMotion.matches) {
      box.classList.remove('entering');
      void box.offsetWidth;
      box.classList.add('entering');
    }
  },
  onActive: () => {
    stopMotion();
    slideshow.box.hidden = true;
  },
  onSlide: () => showSlide(slideshow.index + 1, { fade: !reducedMotion.matches }),
});

// Choosing an item (click or keyboard): the belt stops at once and eases the
// item to the centre, then its section shows (active mode).
function activate(i, { focus = true } = {}) {
  i = step(i, 0, N);
  if (focus) tabs[i].focus({ preventScroll: true });
  centreOn(i, () => {
    idle.activate();
    showSection(i);
  });
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => activate(i));
  tab.addEventListener('keydown', (e) => {
    const n = tabs.length;
    let to = null;
    // Repeated keys during the ease step from where the belt is heading.
    const here = belt.ease ? nearestItem(belt.ease.to, n) : nearestItem(belt.p, n);
    if (e.key === 'ArrowRight') to = step(here, 1, n);
    else if (e.key === 'ArrowLeft') to = step(here, -1, n);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    else if (e.key === 'Enter' || e.key === ' ') to = i;
    if (to === null) return;
    e.preventDefault();
    activate(to);
  });
});
for (const node of [...document.querySelectorAll('[role="tabpanel"]'), $('content'), slideshow.box]) node.addEventListener('animationend', () => node.classList.remove('entering'));
// Only mouse clicks count as activity (not movement, hover or scrolling).
document.addEventListener('click', () => idle.click(), { capture: true, passive: true });
$('content').addEventListener('focusout', () => idle.focusLeft());
// Hidden tab: no timers, no frames; back: continue with no jump.
document.addEventListener('visibilitychange', () => {
  const hidden = document.visibilityState === 'hidden';
  idle.setHidden(hidden);
  if (hidden) stopLoop();
  else if (belt.running || belt.ease) startLoop();
});
reducedMotion.addEventListener('change', () => idle.mode === 'idle' && startMotion());
// The number of neighbours shown and the slot width change with the window
// width: measure again after a resize (at most once per frame).
let resizeQueued = false;
addEventListener('resize', () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    measureBelt();
    renderBelt();
  });
});

// Start: About centred, idle. options.html#feeds etc. opens that section
// directly (active mode), as before.
const fromHash = () => TAB_IDS.indexOf(location.hash.slice(1));
measureBelt();
renderBelt();
if (fromHash() >= 0) {
  belt.p = fromHash();
  renderBelt();
  idle.activate();
  showSection(fromHash(), { animate: false });
} else {
  idle.start();
}
idle.setHidden(document.visibilityState === 'hidden');
addEventListener('hashchange', () => fromHash() >= 0 && fromHash() !== shown && activate(fromHash(), { focus: false }));
loadSlides();

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
