// Messaging wrapper. Content scripts and extension pages call send(); the
// service worker registers handlers with serve().

// Returns the handler's result, or null if the extension context is gone
// (extension reloaded/updated while the page stayed open) or nothing answered.
export async function send(type, payload = {}) {
  try {
    const res = await chrome.runtime.sendMessage({ type, payload });
    if (res && res.error) throw new Error(res.error);
    return res ? res.result : null;
  } catch (e) {
    if (/context invalidated|Receiving end does not exist/i.test(String(e?.message))) return null;
    throw e;
  }
}

// handlers: { [type]: async (payload, sender) => result }
export function serve(handlers) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const fn = msg && handlers[msg.type];
    if (!fn) return false;
    Promise.resolve()
      .then(() => fn(msg.payload || {}, sender))
      .then((result) => sendResponse({ result }))
      .catch((e) => sendResponse({ error: String(e?.message || e) }));
    return true; // async response
  });
}

export function extensionUrl(path) {
  return chrome.runtime.getURL(path);
}

export function isExtensionAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}
