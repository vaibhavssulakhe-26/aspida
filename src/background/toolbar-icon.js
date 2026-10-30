// Toolbar icon that follows the current site: the top-level page URL is run
// through the same local analyzer as links (nothing is fetched) and the
// tab's icon and tooltip are set from the verdict. Recomputed on every
// commit, so no per-tab state is kept (the worker may sleep at any time).

import { analyzeOne } from './analyzer.js';
import { getSettings } from '../platform/storage.js';
import { setTabAction, listTopFrames } from '../platform/browser.js';
import { iconStateForVerdict, iconTitleForVerdict, iconPaths } from '../scoring/icon-state.js';

export async function updateTabIcon({ tabId, url }, settings) {
  if (!(tabId >= 0)) return;
  settings ??= await getSettings();
  let verdict = null; // not checked -> normal icon
  if (settings.toolbarIcon && /^https?:\/\//i.test(url || '')) {
    verdict = await analyzeOne(url).catch(() => null);
  }
  // Rejects if the tab closed in the meantime; callers ignore that.
  await setTabAction(tabId, iconPaths(iconStateForVerdict(verdict)), iconTitleForVerdict(verdict, settings.uiLanguage));
}

// After install/startup, a settings change or an allowlist change. With the
// setting off this resets every tab to the normal icon.
export async function refreshAllTabIcons(settings) {
  settings ??= await getSettings();
  const frames = await listTopFrames();
  await Promise.all(frames.map((f) => updateTabIcon(f, settings).catch(() => {})));
}
