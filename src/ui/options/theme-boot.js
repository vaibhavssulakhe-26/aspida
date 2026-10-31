// Runs before the stylesheet paints anything: applies the theme the page
// last used (a copy of the 'theme' setting, which stays the source of truth
// and is re-applied by options.js). No chrome.* here; localStorage is only a
// per-page cache and may be unavailable.
(() => {
  const root = document.documentElement;
  let theme = null;
  try {
    theme = localStorage.getItem('aspida-theme');
  } catch {
    // No cache: 'auto' (the CSS follows prefers-color-scheme).
  }
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.toggleAttribute('data-dark', dark);
})();
