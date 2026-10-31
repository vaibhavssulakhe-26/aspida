// Content entry (loaded by loader.js via dynamic import). Reads settings,
// starts the enabled modules for this site, and stops/starts them live when
// settings change. Site modules are picked by hostname.

import { getSettings, onSettingsChanged, onLocalChanged } from '../platform/storage.js';
import { clearVerdictCache } from './link-scanner.js';
import { setLanguage, getLanguage } from '../config/strings/index.js';
import { setTheme, getTheme } from '../ui/render.js';
import { isExtensionAlive } from '../platform/messaging.js';
import { setDebug, debug } from './util.js';
import * as hoverLinks from './hover-links.js';
import * as qrHover from './qr-hover.js';
import { createChatScanner, matchesSite } from './chat.js';
import whatsapp from './sites/whatsapp.selectors.js';
import telegram from './sites/telegram.selectors.js';
import instagram from './sites/instagram.selectors.js';
import demoChat from './sites/demo-chat.selectors.js';
import { createGmail, matchesGmail } from './gmail.js';
import gmailSite from './sites/gmail.selectors.js';
import demoGmail from './sites/demo-gmail.selectors.js';

// [settingKey, module, page test]. Page tests are re-evaluated on every
// settings change and on SPA navigations (Instagram /direct/ is client-routed).
const chatModule = (site) => [site.settingKey, createChatScanner(site), () => matchesSite(site)];
const MODULES = [
  ['hoverVerdict', hoverLinks, () => true],
  ['qrHover', qrHover, () => true],
  chatModule(whatsapp),
  chatModule(telegram),
  chatModule(instagram),
  chatModule(demoChat),
  ...[gmailSite, demoGmail].flatMap((site) => {
    const g = createGmail(site);
    return [
      [site.bannerSetting, g.banner, () => matchesGmail(site)],
      [site.inboxSetting, g.inbox, () => matchesGmail(site)],
    ];
  }),
];

const running = new Set();

function apply(settings) {
  setDebug(settings.debug);
  // New interface language or theme: restart running modules so banners and
  // badges are re-rendered (tooltips pick it up on the next hover).
  const before = `${getLanguage()}|${getTheme()}`;
  if (`${setLanguage(settings.uiLanguage)}|${setTheme(settings.theme)}` !== before) {
    for (const mod of [...running]) {
      try {
        mod.stop();
      } catch (e) {
        debug('module failed to stop', e);
      }
      running.delete(mod);
    }
  }
  for (const [key, mod, matches] of MODULES) {
    const want = !!settings[key] && matches();
    try {
      if (want && !running.has(mod)) {
        mod.start(settings);
        running.add(mod);
      } else if (want) {
        mod.update?.(settings);
      } else if (!want && running.has(mod)) {
        mod.stop();
        running.delete(mod);
      }
    } catch (e) {
      debug(`module ${key} failed to ${want ? 'start' : 'stop'}`, e);
    }
  }
}

export async function start() {
  if (!isExtensionAlive()) return;
  let current = await getSettings();
  apply(current);
  onSettingsChanged((s) => {
    clearVerdictCache();
    apply((current = s));
  });
  onLocalChanged((keys) => keys.includes('allowlist') && clearVerdictCache());
  // SPA route changes (no reload): re-check page tests now and then.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      apply(current);
    }
  }, 1000);
}
