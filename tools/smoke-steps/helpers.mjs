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
      const visible = outerHTML.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<div class="tl-float\b[^"]*"(?![^>]*data-open)[^>]*>[\s\S]*?<\/div>\s*(?=<|$)/g, '');
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
  // Closed (fading out) or hidden tooltip => treat as no text. The open state
  // is set synchronously on show, so this never depends on transition timing.
  return /class="tl-float\b[^"]*"(?![^>]*data-open)/.test(o.html) ? '' : o.text;
}

// Computed state of the tooltip element once its transition has settled:
// { open, hidden, opacity, transform, willChange, pointerEvents } or null.
export async function tooltipState(page) {
  const cdp = await page.createCDPSession();
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    let nodeId = null;
    const walk = (n) => {
      if (nodeId) return;
      const attrs = n.attributes || [];
      for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'class' && attrs[i + 1].split(/\s+/).includes('tl-float')) nodeId = n.nodeId;
      for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) walk(c);
    };
    walk(root);
    if (!nodeId) return null;
    const { object } = await cdp.send('DOM.resolveNode', { nodeId });
    const { result } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId,
      returnByValue: true,
      functionDeclaration: `function () {
        const cs = getComputedStyle(this);
        return { open: this.hasAttribute('data-open'), hidden: this.hidden, opacity: cs.opacity, transform: cs.transform,
          willChange: this.style.willChange, pointerEvents: cs.pointerEvents, running: this.getAnimations().length };
      }`,
    });
    return result.value;
  } finally {
    await cdp.detach();
  }
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

// Centre of the first element inside Aspida's closed overlay whose class
// list contains cls (CDP pierces closed roots), or null.
export async function overlayPoint(page, cls) {
  const cdp = await page.createCDPSession();
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    let nodeId = null;
    const walk = (n) => {
      if (nodeId) return;
      const attrs = n.attributes || [];
      for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'class' && attrs[i + 1].split(/\s+/).includes(cls)) nodeId = n.nodeId;
      for (const c of [...(n.children || []), ...(n.shadowRoots || [])]) walk(c);
    };
    walk(root);
    if (!nodeId) return null;
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId }).catch(() => ({}));
    if (!model) return null;
    const [x1, y1, , , x3, y3] = model.border;
    return { x: (x1 + x3) / 2, y: (y1 + y3) / 2 };
  } finally {
    await cdp.detach();
  }
}

export async function clickOverlay(page, cls, { steps = 8 } = {}) {
  const p = await overlayPoint(page, cls);
  if (!p) return false;
  await page.mouse.move(p.x, p.y, { steps });
  await page.mouse.click(p.x, p.y);
  return true;
}
