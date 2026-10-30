// Classic content script (MV3 content scripts can't be ES modules). It only
// imports the real module graph from the extension package. Fails silently:
// Aspida must never break the host page.
(async () => {
  try {
    const mod = await import(chrome.runtime.getURL('src/content/main.js'));
    await mod.start();
  } catch (e) {
    // Extension reloaded, page CSP edge case, etc. Nothing to do.
  }
})();
