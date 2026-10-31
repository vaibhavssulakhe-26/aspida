// Wrappers for the remaining chrome.* APIs the service worker and extension
// pages use: alarms, navigation events, tabs, toolbar action, runtime lifecycle.

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

// fn({ tabId, url }) whenever a tab's top-level page commits or changes URL
// in place (history.pushState). Prerendered pages use a non-zero frameId and
// are skipped until they become the tab's page.
export function onTopPageChanged(fn) {
  const relay = (d) => {
    if (d.frameId === 0) fn({ tabId: d.tabId, url: d.url });
  };
  chrome.webNavigation.onCommitted.addListener(relay);
  chrome.webNavigation.onHistoryStateUpdated.addListener(relay);
}

// [{ tabId, url }] for every open tab's top frame. webNavigation.getFrame
// gives the URL without the "tabs" permission; url is undefined when the
// frame is unavailable (discarded tab, error page).
export async function listTopFrames() {
  const tabs = await chrome.tabs.query({});
  return Promise.all(
    tabs.map(async (t) => ({ tabId: t.id, url: await chrome.webNavigation.getFrame({ tabId: t.id, frameId: 0 }).then((f) => f?.url, () => undefined) })),
  );
}

// Tab-specific toolbar icon and tooltip. paths: { size: manifest-relative path }.
export function setTabAction(tabId, paths, title) {
  return Promise.all([chrome.action.setIcon({ tabId, path: paths }), chrome.action.setTitle({ tabId, title })]);
}

export function onTabRemoved(fn) {
  chrome.tabs.onRemoved.addListener((tabId) => fn(tabId));
}

// New foreground tab, opened only on an explicit user click ("Report this
// link"). chrome.tabs.create needs no permission.
export function openTab(url) {
  return chrome.tabs.create({ url });
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
