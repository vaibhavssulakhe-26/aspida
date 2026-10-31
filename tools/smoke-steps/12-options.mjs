// Settings page: idle mode on load (navbar rotating, slideshow, no section),
// choosing an item (centred, content shown, rotation stopped), wrap-around and
// keyboard, back to idle after 10 s without a click (not while typing),
// narrow layout, theme button, and every feature switch saving to storage.
import { sleep, waitFor, setSetting } from './helpers.mjs';

const SETTLE_MS = 450; // slide is 260 ms

export default async function ({ browser, extId, fail }) {
  const opts = await browser.newPage();
  await opts.setViewport({ width: 1280, height: 900 });
  await opts.goto(`chrome-extension://${extId}/src/ui/options/options.html`);
  await opts.waitForSelector('#features input');

  const state = () => opts.evaluate(() => {
    const bar = document.querySelector('.carousel').getBoundingClientRect();
    const mid = bar.left + bar.width / 2;
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const chosen = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    const sel = chosen || tabs.find((t) => t.tabIndex === 0); // idle: the centred item
    const r = sel.getBoundingClientRect();
    const slides = [...document.querySelectorAll('#slideshow img')];
    const shown = tabs.filter((t) => !t.hasAttribute('data-out')).map((t) => ({ id: t.dataset.tab, x: t.getBoundingClientRect().left + t.getBoundingClientRect().width / 2 }));
    shown.sort((a, b) => a.x - b.x);
    return {
      selected: sel.dataset.tab,
      mode: chosen ? 'active' : 'idle',
      slideshow: !document.getElementById('slideshow').hidden,
      slides: slides.length,
      slide: slides.findIndex((i) => i.classList.contains('on')),
      content: !document.getElementById('content').hidden,
      centred: Math.abs(r.left + r.width / 2 - mid) < 2,
      bigger: r.height > Math.max(...tabs.filter((t) => t !== sel).map((t) => t.getBoundingClientRect().height)),
      focused: document.activeElement?.dataset?.tab || null,
      tabindex: tabs.map((t) => t.tabIndex).join(','),
      order: shown.map((s) => s.id).join(' '),
      panels: [...document.querySelectorAll('[role="tabpanel"]')].filter((p) => !p.hidden).map((p) => p.id).join(','),
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      tabsInside: shown.every((s) => s.x > 0 && s.x < innerWidth),
    };
  });
  const expect = async (want, what) => {
    await sleep(SETTLE_MS);
    const s = await state();
    for (const [k, v] of Object.entries(want)) if (s[k] !== v) fail(`options navbar ${what}: ${k} = ${JSON.stringify(s[k])}, want ${JSON.stringify(v)} (${JSON.stringify(s)})`);
    return s;
  };

  // Load: idle. About centred, no tab selected, no section, slideshow on.
  await waitFor(async () => (await state()).slides > 0, 'slides loaded', 5000).catch(() => {});
  const start = await expect({ mode: 'idle', selected: 'about', centred: true, bigger: true, panels: '', content: false, slideshow: true, slides: 5, order: 'stats data about features feeds', hScroll: false }, 'idle on load');
  if (await opts.$eval('#slideshow', (b) => b.getAttribute('aria-live')) !== 'off') fail('slideshow must not be announced (aria-live off)');
  const alts = await opts.$$eval('#slideshow img', (is) => is.map((i) => i.alt));
  if (alts[0] !== 'Aspida screenshot 1 of 5' || alts[4] !== 'Aspida screenshot 5 of 5') fail(`slide alt text: ${alts}`);
  // Rotates every 2 s (one item), new slide every 1 s; mouse moves don't count.
  await opts.mouse.move(200, 400);
  await opts.mouse.move(900, 600);
  await sleep(2100 - SETTLE_MS);
  const rotated = await expect({ mode: 'idle', selected: 'features', centred: true, order: 'data about features feeds allowlist' }, 'auto-rotate after 2 s');
  if (rotated.slide === start.slide) fail('slideshow did not advance');
  // A click outside the navbar does nothing in idle mode.
  await opts.mouse.click(30, 600);
  await expect({ mode: 'idle', content: false }, 'click outside the navbar while idle');

  // Click a visible item: it moves to the centre, rotation stops, section shows.
  await opts.click('#tab-allowlist');
  await expect({ mode: 'active', selected: 'allowlist', centred: true, focused: 'allowlist', panels: 'panel-allowlist', content: true, slideshow: false }, 'after click');
  await sleep(2300);
  await expect({ selected: 'allowlist', mode: 'active' }, 'rotation stopped');
  await opts.click('#tab-feeds');
  await expect({ selected: 'feeds', centred: true, focused: 'feeds', panels: 'panel-feeds', order: 'about features feeds allowlist stats' }, 'second click');

  // Arrow keys move the selection around the loop, both ways.
  await opts.keyboard.press('ArrowRight');
  await expect({ selected: 'allowlist', focused: 'allowlist', panels: 'panel-allowlist' }, 'ArrowRight');
  for (let i = 0; i < 3; i++) await opts.keyboard.press('ArrowLeft');
  await expect({ selected: 'about', centred: true, order: 'stats data about features feeds' }, 'ArrowLeft x3');
  await opts.keyboard.press('ArrowLeft');
  await expect({ selected: 'data', centred: true, panels: 'panel-data', order: 'allowlist stats data about features' }, 'wrap left past About');
  await opts.keyboard.press('ArrowRight');
  await expect({ selected: 'about' }, 'wrap right past Your data');

  // Narrow widths: one neighbour each side, same behaviour, no sideways scroll.
  for (const width of [600, 360]) {
    await opts.setViewport({ width, height: 800 });
    await expect({ selected: 'about', centred: true, order: 'data about features', hScroll: false, tabsInside: true }, `${width}px`);
  }
  await opts.click('#tab-features');
  await expect({ selected: 'features', centred: true, order: 'about features feeds', panels: 'panel-features', hScroll: false }, 'narrow click');
  await opts.setViewport({ width: 1280, height: 900 });

  // Every feature switch saves to storage (and back).
  const keys = await opts.$$eval('#features input', (es) => es.map((e) => e.id.slice(2)));
  const stored = () => opts.evaluate(async () => (await chrome.storage.local.get('settings')).settings || {});
  for (const key of keys) {
    const was = await opts.$eval(`#f-${key}`, (e) => e.checked);
    await opts.click(`label[for="f-${key}"]`);
    await waitFor(async () => (await stored())[key] === !was, `switch ${key} saved`, 3000).catch(() => fail(`feature switch ${key} did not save`));
    await opts.click(`label[for="f-${key}"]`);
    await waitFor(async () => (await stored())[key] === was, `switch ${key} restored`, 3000).catch(() => fail(`feature switch ${key} did not save back`));
  }
  console.log(`  ${keys.length} feature switches save`);

  // Typing in the allowlist box keeps the section (no click for > 10 s); 10 s
  // after the field loses focus, back to idle: slideshow from slide 1, no tab
  // selected, rotation resumes.
  await opts.click('#tab-allowlist');
  await opts.focus('#allow-input');
  await opts.keyboard.type('example.org');
  await sleep(10_800);
  await expect({ mode: 'active', panels: 'panel-allowlist' }, 'typing keeps the section open');
  await opts.evaluate(() => document.activeElement.blur());
  await sleep(9_500);
  await expect({ mode: 'active' }, 'still active 9.5 s after blur');
  const back = await waitFor(async () => { const st = await state(); return st.mode === 'idle' ? st : null; }, 'idle again', 2500).catch(() => null);
  if (!back) fail('did not return to idle 10 s after the last activity');
  else {
    if (back.content || !back.slideshow || back.panels) fail(`idle again: ${JSON.stringify(back)}`);
    if (back.slide !== 0) fail(`slideshow did not restart from slide 1 (slide ${back.slide})`);
  }
  await sleep(2100);
  const after = await state();
  if (back && after.selected === back.selected) fail('navbar rotation did not resume');
  if ((await opts.$eval('#allow-input', (i) => i.value)) !== 'example.org') fail('typed text lost');
  await opts.$eval('#allow-input', (i) => (i.value = ''));

  // Theme button: overrides the system, is remembered, survives a reload.
  const look = () => opts.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'auto', dark: document.documentElement.hasAttribute('data-dark'), bg: getComputedStyle(document.body).backgroundColor, label: document.getElementById('theme').getAttribute('aria-label') }));
  await opts.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  let l = await look();
  if (l.theme !== 'auto' || l.dark || l.bg !== 'rgb(233, 236, 239)') fail(`options default theme: ${JSON.stringify(l)}`);
  await opts.click('#theme');
  await waitFor(async () => (await stored()).theme === 'dark', 'theme saved', 3000).catch(() => fail('theme choice not saved'));
  l = await look();
  if (l.theme !== 'dark' || !l.dark || l.bg !== 'rgb(20, 37, 61)' || l.label !== 'Switch to light theme') fail(`dark theme not applied: ${JSON.stringify(l)}`);
  await opts.reload();
  await opts.waitForSelector('#features input');
  l = await look();
  if (l.theme !== 'dark' || l.bg !== 'rgb(20, 37, 61)') fail(`dark theme lost on reload: ${JSON.stringify(l)}`);
  // 'auto' follows the system scheme.
  await setSetting(browser, extId, { theme: 'auto' });
  await waitFor(async () => (await look()).theme === 'auto', 'theme back to auto', 3000).catch(() => fail('theme setting change not applied live'));
  await opts.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await waitFor(async () => (await look()).dark, 'dark system scheme', 3000).catch(() => {});
  l = await look();
  if (!l.dark || l.bg !== 'rgb(20, 37, 61)') fail(`auto theme ignores a dark system: ${JSON.stringify(l)}`);
  await opts.close();
}
