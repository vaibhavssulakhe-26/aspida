// Copy text after a user click (no chrome.* needed). Tries the async
// Clipboard API, then a hidden textarea + execCommand inside the given root
// (works on plain-http pages, where navigator.clipboard is unavailable).
// Resolves true when the text was copied.
export async function copyText(text, root = document) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through (no focus, permission policy, insecure context)
  }
  try {
    const doc = root.ownerDocument || root;
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    (root.body || root).append(ta);
    ta.select();
    const ok = doc.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}
