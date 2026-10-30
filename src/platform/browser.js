// Wrappers for the remaining chrome.* APIs the service worker and extension
// pages use: alarms, navigation events, tabs, runtime lifecycle, permissions.

export function ensureAlarm(name, periodInMinutes) {
  return chrome.alarms.get(name).then((a) => {
    if (!a || a.periodInMinutes !== periodInMinutes) {
      return chrome.alarms.create(name, { periodInMinutes, delayInMinutes: 1 });
    }
  });
}

export function onAlarm(name, fn) {
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === name) fn();
  });
}

export function onInstalled(fn) {
  chrome.runtime.onInstalled.addListener(fn);
}

export function onStartup(fn) {
  chrome.runtime.onStartup.addListener(fn);
}

// fn({ tabId, url, frameId }) for top-frame navigations only.
export function onBeforeTopNavigate(fn) {
  chrome.webNavigation.onBeforeNavigate.addListener((d) => {
    if (d.frameId === 0) fn(d);
  });
}

export function onTabRemoved(fn) {
  chrome.tabs.onRemoved.addListener((tabId) => fn(tabId));
}

export function navigateTab(tabId, url) {
  return chrome.tabs.update(tabId, { url });
}

export async function closeCurrentTab() {
  const tab = await chrome.tabs.getCurrent();
  if (tab) await chrome.tabs.remove(tab.id);
}

export function onActionClicked(fn) {
  chrome.action.onClicked.addListener(fn);
}

export function openOptionsPage() {
  return chrome.runtime.openOptionsPage();
}

export function extensionUrl(path) {
  return chrome.runtime.getURL(path);
}

export function manifestVersion() {
  return chrome.runtime.getManifest().version;
}
