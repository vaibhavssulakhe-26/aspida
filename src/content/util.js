// Small helpers shared by content modules: debug logging and fail-soft
// wrappers. Content code must never throw into the host page.

let debugOn = false;

export function setDebug(on) {
  debugOn = !!on;
}

export function debug(...args) {
  if (debugOn) console.debug('[TrustLens]', ...args);
}

// Wrap an event handler / callback so errors are swallowed (and logged in
// debug mode) instead of surfacing in the page.
export function safe(fn, label = 'handler') {
  return function safeWrapped(...args) {
    try {
      const r = fn.apply(this, args);
      if (r && typeof r.catch === 'function') r.catch((e) => debug(`${label} failed`, e));
      return r;
    } catch (e) {
      debug(`${label} failed`, e);
      return undefined;
    }
  };
}

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Visible text of an anchor, cheaply (textContent avoids forcing layout).
export function anchorText(a) {
  return (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function httpHref(a) {
  const href = a?.href;
  return typeof href === 'string' && /^https?:\/\//i.test(href) ? href : null;
}
