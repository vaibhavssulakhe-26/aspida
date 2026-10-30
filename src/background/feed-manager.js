// Downloads, parses and stores threat feeds; answers local lookups.
// State lives in chrome.storage.local ('feedStatus') and IndexedDB only.
//
// 'feedStatus:<id>' = { activeGen, urls, hosts, lastSuccess, lastAttempt, error }
// One key per feed, so concurrent refreshes of different feeds can't
// overwrite each other's status. 'dataEpoch' changes on "clear all data";
// a refresh that started before a clear never writes its result after it.

import { FEEDS } from '../config/feeds.js';
import { parseFeed } from '../core/feed-parse.js';
import { feedUrlKey, hostLookupChain } from '../core/url.js';
import { getLocal, setLocal, getSettings, getSession, setSession } from '../platform/storage.js';
import { putEntries, deleteGenerations, findExisting, deleteDatabase } from '../platform/idb.js';
import { extensionUrl } from '../platform/browser.js';

const FETCH_TIMEOUT_MS = 90_000;
const LOCK_STALE_MS = 10 * 60_000;

const statusKey = (id) => `feedStatus:${id}`;

export async function getFeedStatus() {
  const entries = await Promise.all(FEEDS.map(async (f) => [f.id, await getLocal(statusKey(f.id), undefined)]));
  return Object.fromEntries(entries.filter(([, v]) => v));
}

async function patchStatus(id, patch) {
  const next = { ...(await getLocal(statusKey(id), {})), ...patch };
  await setLocal(statusKey(id), next);
  return next;
}

export async function bumpDataEpoch() {
  await setLocal('dataEpoch', Date.now());
}

function feedUrl(feed, settings) {
  if (feed.bundled) return extensionUrl(feed.bundled);
  if (feed.needsKey) {
    const key = (settings.urlhausAuthKey || '').trim();
    if (!/^[A-Za-z0-9]{8,128}$/.test(key)) return null;
    return feed.urlTemplate.replace('{key}', encodeURIComponent(key));
  }
  return feed.url;
}

async function download(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    // credentials omitted: feed hosts never get cookies or anything about the user.
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Refresh one feed. On any failure the previous generation stays active.
export async function refreshFeed(id, { force = false } = {}) {
  const feed = FEEDS.find((f) => f.id === id);
  if (!feed) throw new Error(`unknown feed ${id}`);
  const settings = await getSettings();
  if (!settings.feeds[id]) return patchStatus(id, { error: null, disabled: true });
  const url = feedUrl(feed, settings);
  if (!url) return patchStatus(id, { error: 'Auth-Key not set', lastAttempt: Date.now(), disabled: false });

  // Single-flight per feed across worker restarts.
  const lockKey = `feedLock:${id}`;
  const lockedAt = await getSession(lockKey, 0);
  if (lockedAt && Date.now() - lockedAt < LOCK_STALE_MS && !force) return getLocal(statusKey(id), null);
  await setSession(lockKey, Date.now());

  const epoch = await getLocal('dataEpoch', 0);
  const stillCurrent = async () => (await getLocal('dataEpoch', 0)) === epoch;
  const prev = await getLocal(statusKey(id), {});
  try {
    await patchStatus(id, { lastAttempt: Date.now(), disabled: false });
    const text = await download(url);
    const parsed = parseFeed(feed.format, text);
    if (!parsed.urls.length && !parsed.hosts.length) throw new Error('feed was empty or unparseable');
    const gen = (prev.activeGen || 0) + 1;
    await putEntries(id, gen, 'url', parsed.urls);
    await putEntries(id, gen, 'host', parsed.hosts);
    if (!(await stillCurrent())) return null; // data was cleared meanwhile
    const status = await patchStatus(id, { activeGen: gen, urls: parsed.urls.length, hosts: parsed.hosts.length, lastSuccess: Date.now(), error: null });
    await deleteGenerations(id, gen);
    return status;
  } catch (e) {
    if (!(await stillCurrent())) return null;
    return patchStatus(id, { error: String(e?.message || e) });
  } finally {
    await setSession(lockKey, 0);
  }
}

function isDue(feed, status) {
  if (!status?.activeGen) return true;
  if (!feed.refreshHours) return false;
  return Date.now() - (status.lastSuccess || 0) >= feed.refreshHours * 3600_000;
}

// Called on install/startup and by the hourly alarm.
export async function refreshDueFeeds() {
  const [settings, status] = await Promise.all([getSettings(), getFeedStatus()]);
  for (const feed of FEEDS) {
    if (!settings.feeds[feed.id]) continue;
    // Back off for an hour after a failure so a dead host isn't hammered.
    const st = status[feed.id];
    if (st?.error && Date.now() - (st.lastAttempt || 0) < 3600_000) continue;
    if (isDue(feed, st)) await refreshFeed(feed.id);
  }
}

// Disabling a feed drops its entries; re-enabling re-downloads.
export async function applyFeedToggles(settings) {
  const status = await getFeedStatus();
  for (const feed of FEEDS) {
    if (!settings.feeds[feed.id] && status[feed.id]?.activeGen) {
      await deleteGenerations(feed.id, null);
      await patchStatus(feed.id, { activeGen: 0, urls: 0, hosts: 0, disabled: true });
    }
  }
}

// Local lookup. Returns [{ source, kind, value }]. Never touches the network.
export async function lookup(rawUrl) {
  const [settings, status] = await Promise.all([getSettings(), getFeedStatus()]);
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return [];
  }
  const key = feedUrlKey(rawUrl);
  const candidates = [];
  if (key) {
    candidates.push(['url', key]);
    const noQuery = key.split('?')[0];
    if (noQuery !== key) candidates.push(['url', noQuery]);
  }
  for (const h of hostLookupChain(url.hostname)) candidates.push(['host', h]);

  const keys = [];
  for (const feed of FEEDS) {
    const st = status[feed.id];
    if (!settings.feeds[feed.id] || !st?.activeGen) continue;
    for (const [kind, value] of candidates) keys.push([feed.id, st.activeGen, kind, value]);
  }
  const found = await findExisting(keys);
  return found.map(([source, , kind, value]) => ({ source: FEEDS.find((f) => f.id === source)?.name || source, kind, value }));
}

export async function wipeFeeds() {
  await deleteDatabase();
}
