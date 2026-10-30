// Interstitial for navigations to known-malicious (feed) URLs and, if the
// setting allows, the "High risk" tier. Everything below that is left to
// the in-page tooltip. MV3 has no blocking webRequest, so we redirect the
// tab to our warning page as soon as onBeforeNavigate fires.
//
// Bypasses ("Proceed anyway") are per tab + registrable domain and live in
// storage.session, so they vanish when the tab or browser closes.

import { analyzeOne, bumpStat, allowlistKeyFor } from './analyzer.js';
import { getSettings, getSession, setSession } from '../platform/storage.js';
import { navigateTab, extensionUrl } from '../platform/browser.js';

export const WARNING_PAGE = 'src/ui/warning/warning.html';

export function shouldInterstitial(verdict, settings) {
  if (!verdict) return false;
  if (verdict.tier === 'malicious') return true;
  return verdict.tier === 'high' && settings.blockHighRisk;
}

async function hasBypass(tabId, url) {
  const bypass = await getSession('bypass', {});
  return (bypass[tabId] || []).includes(allowlistKeyFor(url));
}

export async function addBypass(tabId, url) {
  const bypass = await getSession('bypass', {});
  const key = allowlistKeyFor(url);
  bypass[tabId] = [...new Set([...(bypass[tabId] || []), key])];
  await setSession('bypass', bypass);
}

export async function dropTab(tabId) {
  const bypass = await getSession('bypass', {});
  if (bypass[tabId]) {
    delete bypass[tabId];
    await setSession('bypass', bypass);
  }
}

export async function handleNavigation({ tabId, url }) {
  if (tabId < 0 || !/^https?:/i.test(url)) return;
  const settings = await getSettings();
  if (!settings.navigationGuard) return;
  if (await hasBypass(tabId, url)) return;
  const verdict = await analyzeOne(url);
  if (!shouldInterstitial(verdict, settings)) return;
  await bumpStat('blocked');
  await navigateTab(tabId, `${extensionUrl(WARNING_PAGE)}?url=${encodeURIComponent(url)}`);
}
