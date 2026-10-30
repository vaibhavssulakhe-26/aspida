export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(fn, what, timeout = 15000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}`);
}

// Read the text of Aspida's closed shadow roots via CDP (pierce:true sees
// closed roots, page scripts and querySelector don't).
// Returns [{ kind: 'overlay'|'badge'|'banner', html, text }]
export async function aspidaShadows(page) {
  const cdp = await page.createCDPSession();
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const found = [];
    const walk = (n) => {
      const attrs = n.attributes || [];
      for (let i = 0; i < attrs.length; i += 2) {
        const m = /^data-aspida-(overlay|badge|banner)$/.exec(attrs[i]);
        if (m && n.shadowRoots?.length) found.push({ kind: m[1], nodeId: n.shadowRoots[0].nodeId });
      }
      for (const c of [...(n.children || []), ...(n.shadowRoots || []), ...(n.contentDocument ? [n.contentDocument] : [])]) walk(c);
    };
    walk(root);
    const out = [];
    for (const f of found) {
      const { outerHTML } = await cdp.send('DOM.getOuterHTML', { nodeId: f.nodeId });
      const visible = outerHTML.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<div class="tl-float" [^>]*hidden[^>]*>[\s\S]*?<\/div>\s*(?=<|$)/g, '');
      out.push({ kind: f.kind, html: outerHTML, text: visible.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
    }
    return out;
  } finally {
    await cdp.detach();
  }
}

export async function overlayText(page) {
  const all = await aspidaShadows(page);
  const o = all.find((s) => s.kind === 'overlay');
  if (!o) return '';
  // Hidden tooltip => treat as no text.
  return /class="tl-float"[^>]*hidden/.test(o.html) ? '' : o.text;
}

export async function setSetting(browser, extId, patch) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/src/ui/options/options.html`);
  await page.evaluate(async (patch) => {
    const cur = (await chrome.storage.local.get('settings')).settings || {};
    await chrome.storage.local.set({ settings: { ...cur, ...patch, feeds: { ...(cur.feeds || {}), ...(patch.feeds || {}) } } });
  }, patch);
  await page.close();
}
