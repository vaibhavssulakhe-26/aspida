// Aspida service worker entry. Registers every listener synchronously at
// top level (required for MV3 wake-ups) and keeps no state in globals.

import { serve } from '../platform/messaging.js';
import { getLocal, setLocal, getSettings, onSettingsChanged, onLocalChanged, clearAllStorage } from '../platform/storage.js';
import { ensureAlarm, onAlarm, onInstalled, onStartup, onBeforeTopNavigate, onTopPageChanged, onTabRemoved, onActionClicked, openOptionsPage, openTab } from '../platform/browser.js';
import { FEEDS, FEED_ALARM, FEED_ALARM_PERIOD_MINUTES } from '../config/feeds.js';
import { refreshDueFeeds, refreshFeed, getFeedStatus, applyFeedToggles, wipeFeeds, bumpDataEpoch } from './feed-manager.js';
import { analyzeMany, analyzeOne, analyzeEmail, analyzeSenders, invalidateContext, allowlistKeyFor, bumpStat } from './analyzer.js';
import { handleNavigation, addBypass, dropTab } from './navigation-guard.js';
import { decodeQrFromUrl } from './qr-fetch.js';
import { updateTabIcon, refreshAllTabIcons } from './toolbar-icon.js';
import { destinationUrl, reportableUrl, wrongWarningIssueUrl, REPORTABLE_TIERS } from '../core/report.js';

async function init() {
  refreshAllTabIcons().catch((e) => console.warn('Aspida toolbar icon refresh failed', e));
  await ensureAlarm(FEED_ALARM, FEED_ALARM_PERIOD_MINUTES);
  await refreshDueFeeds();
}

onInstalled(() => init().catch((e) => console.warn('Aspida init failed', e)));
onStartup(() => init().catch((e) => console.warn('Aspida init failed', e)));
onAlarm(FEED_ALARM, () => refreshDueFeeds().catch((e) => console.warn('Aspida feed refresh failed', e)));
onActionClicked(() => openOptionsPage());

onBeforeTopNavigate((d) => handleNavigation(d).catch((e) => console.warn('Aspida navigation check failed', e)));
onTopPageChanged((d) => updateTabIcon(d).catch(() => {})); // tab closed mid-check
onTabRemoved((tabId) => dropTab(tabId).catch(() => {}));

onSettingsChanged((s) => {
  invalidateContext(); // the reference context carries which checks are switched off
  applyFeedToggles(s).then(refreshDueFeeds).catch((e) => console.warn('Aspida feed toggle failed', e));
  refreshAllTabIcons(s).catch((e) => console.warn('Aspida toolbar icon refresh failed', e));
});
onLocalChanged((keys) => {
  if (keys.includes('allowlist')) {
    invalidateContext();
    refreshAllTabIcons().catch((e) => console.warn('Aspida toolbar icon refresh failed', e));
  }
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

  // "Report this link": the user clicked a destination. Only tab opens from
  // the fixed list in core/report.js; the extension itself sends nothing.
  'open-report': async ({ dest, target, signals, tier }) => {
    if (!(await getSettings()).reportButton) throw new Error('report button is off');
    const url = reportableUrl(target, { strip: false });
    if (!url) throw new Error('not a reportable URL');
    let open;
    if (dest === 'issue') {
      const ids = (Array.isArray(signals) ? signals : []).filter((s) => typeof s === 'string' && /^[a-z_.-]{1,64}$/.test(s)).slice(0, 20);
      open = wrongWarningIssueUrl(url, { tier: REPORTABLE_TIERS.has(tier) ? tier : 'unknown', reasons: ids.map((id) => ({ id })) });
    } else {
      open = destinationUrl(dest, url)?.url;
    }
    if (!open) throw new Error('unknown destination');
    await openTab(open);
    return true;
  },

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
