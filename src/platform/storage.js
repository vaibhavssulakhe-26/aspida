// Thin wrapper over chrome.storage. Everything lives in storage.local
// (device only) or storage.session (cleared when the browser closes).

import { mergeSettings } from '../config/settings.js';

const local = () => chrome.storage.local;
const session = () => chrome.storage.session;

export async function getLocal(key, fallback) {
  const r = await local().get(key);
  return r[key] ?? fallback;
}

export async function setLocal(key, value) {
  await local().set({ [key]: value });
}

export async function getSession(key, fallback) {
  const r = await session().get(key);
  return r[key] ?? fallback;
}

export async function setSession(key, value) {
  await session().set({ [key]: value });
}

export async function getSettings() {
  return mergeSettings(await getLocal('settings', {}));
}

export async function updateSettings(patch) {
  const cur = await getSettings();
  const next = mergeSettings({ ...cur, ...patch, feeds: { ...cur.feeds, ...(patch.feeds || {}) } });
  await setLocal('settings', next);
  return next;
}

// Calls fn(newSettings) whenever settings change in any context.
export function onSettingsChanged(fn) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) fn(mergeSettings(changes.settings.newValue));
  });
}

// Calls fn(changedKeys) for any storage.local change.
export function onLocalChanged(fn) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') fn(Object.keys(changes));
  });
}

export async function clearAllStorage() {
  await local().clear();
  await session().clear();
}
