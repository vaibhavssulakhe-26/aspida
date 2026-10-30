// TrustLens service worker entry. Registers every listener synchronously at
// top level (required for MV3 wake-ups) and keeps no state in globals.

import { serve } from '../platform/messaging.js';
import { getLocal, setLocal, onSettingsChanged, onLocalChanged, clearAllStorage } from '../platform/storage.js';
import { ensureAlarm, onAlarm, onInstalled, onStartup, onBeforeTopNavigate, onTabRemoved, onActionClicked, openOptionsPage } from '../platform/browser.js';
import { FEEDS, FEED_ALARM, FEED_ALARM_PERIOD_MINUTES } from '../config/feeds.js';
import { refreshDueFeeds, refreshFeed, getFeedStatus, applyFeedToggles, wipeFeeds, bumpDataEpoch } from './feed-manager.js';
import { analyzeMany, analyzeOne, analyzeEmail, analyzeSenders, invalidateContext, allowlistKeyFor, bumpStat } from './analyzer.js';
import { handleNavigation, addBypass, dropTab } from './navigation-guard.js';
import { decodeQrFromUrl } from './qr-fetch.js';

async function init() {
  await ensureAlarm(FEED_ALARM, FEED_ALARM_PERIOD_MINUTES);
  await refreshDueFeeds();
}

onInstalled(() => init().catch((e) => console.warn('TrustLens init failed', e)));
onStartup(() => init().catch((e) => console.warn('TrustLens init failed', e)));
onAlarm(FEED_ALARM, () => refreshDueFeeds().catch((e) => console.warn('TrustLens feed refresh failed', e)));
onActionClicked(() => openOptionsPage());

onBeforeTopNavigate((d) => handleNavigation(d).catch((e) => console.warn('TrustLens navigation check failed', e)));
onTabRemoved((tabId) => dropTab(tabId).catch(() => {}));

onSettingsChanged((s) => applyFeedToggles(s).then(refreshDueFeeds).catch((e) => console.warn('TrustLens feed toggle failed', e)));
onLocalChanged((keys) => {
  if (keys.includes('allowlist')) invalidateContext();
});

async function addToAllowlist(target) {
  const key = allowlistKeyFor(target);
  if (!key) throw new Error('nothing to allowlist');
  const list = new Set(await getLocal('allowlist', []));
  list.add(key);
  await setLocal('allowlist', [...list].sort());
  invalidateContext();
  return key;
}

serve({
  'analyze-urls': ({ items }) => analyzeMany(Array.isArray(items) ? items : []),
  'analyze-url': ({ url, text }) => analyzeOne(url, text),
  'analyze-email': (payload) => analyzeEmail(payload),
  'analyze-senders': ({ items }) => analyzeSenders(Array.isArray(items) ? items : []),
  'qr-decode': ({ src }) => decodeQrFromUrl(src),
  'qr-decoded': () => bumpStat('qrDecoded'),

  proceed: async ({ url }, sender) => {
    if (sender.tab?.id !== undefined) await addBypass(sender.tab.id, url);
    return true;
  },
  'allowlist-add': ({ target }) => addToAllowlist(target),
  'allowlist-remove': async ({ domain }) => {
    const list = (await getLocal('allowlist', [])).filter((d) => d !== domain);
    await setLocal('allowlist', list);
    invalidateContext();
    return list;
  },

  'feed-status': async () => ({ feeds: FEEDS.map(({ id, name, refreshHours, license, needsKey }) => ({ id, name, refreshHours, license, needsKey: !!needsKey })), status: await getFeedStatus() }),
  'feed-refresh': ({ id }) => refreshFeed(id, { force: true }),
  stats: () => getLocal('stats', {}),

  'clear-all': async () => {
    await wipeFeeds();
    await clearAllStorage();
    await bumpDataEpoch();
    invalidateContext();
    await init(); // re-seeds the bundled demo feed and re-downloads enabled feeds
    return true;
  },
});
