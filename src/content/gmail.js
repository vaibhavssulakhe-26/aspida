// Gmail: (1) banner on each opened email with sender + link checks;
// (2) optional inbox-row highlighting from the sender shown in the list.
// Read-only: never clicks (not even "show details"), replies, sends or edits.
// Selectors live in sites/gmail.selectors.js; misses fail soft.

import { send } from '../platform/messaging.js';
import { blockShadowBefore } from '../ui/overlay.js';
import { renderEmailBanner } from '../ui/render.js';
import { safe, debounce, debug, anchorText, httpHref } from './util.js';

const MAX_LINKS = 200;
const SCAN_DEBOUNCE_MS = 400;

function first(selectors, root) {
  for (const s of selectors) {
    try {
      const el = root.querySelector(s);
      if (el) return el;
    } catch {
      // invalid selector: skip
    }
  }
  return null;
}

function all(selectors, root) {
  for (const s of selectors) {
    try {
      const list = root.querySelectorAll(s);
      if (list.length) return [...list];
    } catch {
      // skip
    }
  }
  return [];
}

// pathPrefix (optional): one prefix or a list of them.
export function matchesGmail(site, loc = location) {
  const prefixes = site.pathPrefix ? [].concat(site.pathPrefix) : [''];
  return site.hosts.includes(loc.hostname) && prefixes.some((p) => loc.pathname.startsWith(p));
}

// Reply-To from the details table, if the user has opened it.
function replyToOf(site, msg) {
  for (const row of all(site.detailRows, msg)) {
    const label = (row.cells?.[0]?.textContent || '').trim().toLowerCase();
    if (!label.startsWith('reply-to') && !label.startsWith('reply to')) continue;
    const span = row.querySelector('[email]');
    return span?.getAttribute('email') || (row.cells?.[1]?.textContent || '').trim();
  }
  return '';
}

// Everything we read from one opened message.
export function extractEmail(site, msg) {
  const s = first(site.sender, msg);
  if (!s) return null;
  const body = first(site.body, msg);
  const links = [];
  const seen = new Set();
  for (const a of body ? body.querySelectorAll('a[href]') : []) {
    const href = httpHref(a);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    links.push({ url: href, text: anchorText(a) });
    if (links.length >= MAX_LINKS) break;
  }
  return {
    sender: {
      displayName: s.getAttribute('name') || s.textContent.trim(),
      address: s.getAttribute('email') || '',
      replyTo: replyToOf(site, msg),
    },
    links,
  };
}

export function createGmail(site) {
  let banners = null; // message element -> { host, signature }
  let bannerMo = null;
  let rows = null; // painted row -> original inline style values
  let checked = null; // row -> sender signature already analysed (Gmail reuses rows)
  let rowMo = null;

  async function renderBanner(msg) {
    const data = extractEmail(site, msg);
    if (!data) return;
    const signature = JSON.stringify(data);
    const existing = banners.get(msg);
    // Same content and banner still shown (or its request still in flight): nothing to do.
    if (existing && existing.signature === signature && (!existing.host || existing.host.isConnected)) return;
    existing?.host.remove();
    banners.set(msg, { host: null, signature }); // claim before the async gap
    const result = await send('analyze-email', data);
    if (!banners || !result || !msg.isConnected) return;
    const anchor = first(site.bannerBefore, msg);
    if (!anchor) {
      debug(`${site.id}: no banner anchor matched`);
      return;
    }
    const notes = [];
    if (!data.sender.replyTo) notes.push("Reply-To isn't shown in Gmail's normal view, so it wasn't checked. Open \"show details\" on the email to include it.");
    notes.push('Gmail does not expose SPF/DKIM/DMARC results to extensions; this check uses the visible sender, links and Reply-To only.');
    const { host, root } = blockShadowBefore(anchor);
    root.append(renderEmailBanner(result, { notes }));
    banners.set(msg, { host, signature });
  }

  function scanMessages() {
    if (!banners) return;
    const msgs = all(site.message, document);
    for (const m of msgs) renderBanner(m).catch((e) => debug(`${site.id}: banner failed`, e));
  }

  // ---- inbox highlighting -------------------------------------------------
  const ROW_STYLE = {
    suspicious: { 'box-shadow': 'inset 4px 0 0 #d4a72c', 'background-color': 'rgba(212, 167, 44, 0.14)' },
    high: { 'box-shadow': 'inset 4px 0 0 #cf222e', 'background-color': 'rgba(207, 34, 46, 0.12)' },
  };

  function paint(row, tier) {
    const style = ROW_STYLE[tier === 'malicious' ? 'high' : tier];
    if (!style) return;
    if (!rows.has(row)) {
      const orig = {};
      for (const p of Object.keys(ROW_STYLE.high)) orig[p] = [row.style.getPropertyValue(p), row.style.getPropertyPriority(p)];
      rows.set(row, orig);
    }
    for (const [p, v] of Object.entries(style)) row.style.setProperty(p, v);
  }

  function unpaint(row) {
    const orig = rows?.get(row);
    if (!orig) return;
    for (const [p, [v, prio]] of Object.entries(orig)) {
      if (v) row.style.setProperty(p, v, prio);
      else row.style.removeProperty(p);
    }
    rows.delete(row);
  }

  function unpaintAll() {
    for (const row of [...(rows?.keys() || [])]) unpaint(row);
    rows = null;
    checked = null;
  }

  async function scanInbox() {
    if (!rows) return;
    const pending = [];
    for (const row of all(site.inboxRow, document)) {
      const s = first(site.inboxSender, row);
      if (!s) continue;
      const sender = { displayName: s.getAttribute('name') || s.textContent.trim(), address: s.getAttribute('email') || '' };
      const sig = `${sender.address}|${sender.displayName}`;
      if (checked.get(row) === sig) continue;
      checked.set(row, sig);
      unpaint(row); // row was reused for a different email
      pending.push({ row, sender });
    }
    if (!pending.length) return;
    const verdicts = await send('analyze-senders', { items: pending.map((p) => p.sender) });
    if (!rows || !verdicts) return;
    pending.forEach((p, i) => {
      const v = verdicts[i];
      if (v && v.tier !== 'none') paint(p.row, v.tier);
    });
  }

  return {
    banner: {
      start() {
        if (banners) return;
        banners = new Map();
        const run = debounce(safe(scanMessages, 'gmail scan'), SCAN_DEBOUNCE_MS);
        bannerMo = new MutationObserver(run);
        bannerMo.observe(document.documentElement, { childList: true, subtree: true });
        run();
        debug(`${site.id}: banner started`);
      },
      stop() {
        if (!banners) return;
        bannerMo.disconnect();
        for (const { host } of banners.values()) host?.remove();
        banners = null;
      },
    },
    inbox: {
      start() {
        if (rows) return;
        rows = new Map();
        checked = new WeakMap();
        const run = debounce(safe(scanInbox, 'gmail inbox'), SCAN_DEBOUNCE_MS);
        rowMo = new MutationObserver(run);
        rowMo.observe(document.documentElement, { childList: true, subtree: true });
        run();
        debug(`${site.id}: inbox highlighting started`);
      },
      stop() {
        if (!rows) return;
        rowMo.disconnect();
        unpaintAll();
      },
    },
  };
}
