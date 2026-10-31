// Gmail: (1) banner on each opened email with sender + link checks;
// (2) optional inbox-row highlighting from the sender shown in the list.
// Read-only: never clicks (not even "show details"), replies, sends or edits.
// Selectors live in sites/gmail.selectors.js; misses fail soft.
//
// The banner can be minimized to a pill (remembered per email for the
// browser session, via the worker). With the reportButton setting on, it has
// "Report sender" (Suspicious / High sender) and "Report this link" buttons,
// and each flagged link in the body gets a small "Report" button after it
// (in its own closed shadow root, so neither side's CSS affects the other).
// Reporting only copies text or asks the worker to open a reporting site in a
// new tab; nothing is sent automatically.

import { send } from '../platform/messaging.js';
import { blockShadowBefore, inlineShadow } from '../ui/overlay.js';
import { renderEmailBanner, renderEmailPill, renderReportPanel, renderSenderReportPanel, renderInlineReport } from '../ui/render.js';
import { copyText } from '../ui/clipboard.js';
import { canReport } from '../core/report.js';
import { emailKey } from '../core/email-key.js';
import { t } from '../config/strings/index.js';
import { openReportPopover, closeReportPopover, destroyReportPopover } from './report-popover.js';
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

function messageIdOf(site, msg) {
  for (const attr of site.messageIdAttrs || []) {
    const v = msg.getAttribute(attr) || msg.querySelector(`[${attr}]`)?.getAttribute(attr);
    if (v) return v;
  }
  return '';
}

const signalsOf = (verdict) => (verdict.reasons || []).map((r) => r.id);

// Confirm steps, shown in the shared report popover next to the button.
function openLinkReport(opener, verdict) {
  const panel = renderReportPanel(verdict, {
    copy: (text) => copyText(text, opener.getRootNode()),
    open: (dest, url) => send('open-report', { dest, target: url, tier: verdict.tier, signals: signalsOf(verdict) }).then((ok) => !!ok, () => false),
    close: () => closeReportPopover(),
  });
  openReportPopover(opener, panel);
}

function openSenderReport(opener, verdict, sender) {
  const panel = renderSenderReportPanel(verdict, sender, {
    copy: (text) => copyText(text, opener.getRootNode()),
    open: (dest) => send('open-report', { kind: 'sender', dest }).then((ok) => !!ok, () => false),
    close: () => closeReportPopover(),
  });
  openReportPopover(opener, panel);
}

export function createGmail(site) {
  let banners = null; // message element -> { host, signature, extras: inline hosts }
  let bannerMo = null;
  let reportOn = true; // settings.reportButton
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
    removeEntry(existing);
    banners.set(msg, { host: null, signature, extras: [] }); // claim before the async gap
    const result = await send('analyze-email', data);
    if (!banners || !result || !msg.isConnected) return;
    const anchor = first(site.bannerBefore, msg);
    if (!anchor) {
      debug(`${site.id}: no banner anchor matched`);
      return;
    }
    const key = emailKey({ messageId: messageIdOf(site, msg), address: data.sender.address, subject: first(site.subject, document)?.textContent || '' });
    const warn = result.summary.tier !== 'none';
    const minimized = warn && key ? !!(await send('banner-state', { key })) : false;
    if (!banners || !msg.isConnected) return;

    const notes = [];
    if (!data.sender.replyTo) notes.push(t('banner.replyToHidden'));
    notes.push(t('banner.noAuthResults'));
    const { host, root } = blockShadowBefore(anchor);
    const box = document.createElement('div');
    root.append(box);
    // Clicks and keys on Aspida's buttons stay inside the banner.
    for (const type of ['click', 'mousedown', 'keydown']) box.addEventListener(type, (e) => e.stopPropagation());

    const draw = (min, focusToggle) => {
      const view = min
        ? renderEmailPill(result.summary, { onExpand: safe(() => toggle(false), 'expand') })
        : renderEmailBanner(result, {
            notes,
            senderInfo: data.sender,
            onMinimize: warn && key ? safe(() => toggle(true), 'minimize') : null,
            onReportSender: reportOn ? safe((b) => openSenderReport(b, result.sender, data.sender), 'report sender') : null,
            onReportLink: reportOn ? safe((v, b) => openLinkReport(b, v), 'report link') : null,
          });
      if (focusToggle) view.classList.add('tl-enter');
      box.replaceChildren(view);
      if (focusToggle) view.querySelector(min ? '.tl-pill' : '.tl-minimize')?.focus({ preventScroll: true });
    };
    const toggle = (min) => {
      closeReportPopover({ restoreFocus: false });
      draw(min, true);
      send('banner-state', { key, minimized: min }).catch(() => {});
    };
    draw(minimized, false);
    const entry = { host, signature, extras: reportOn ? addInlineReports(msg, data, result) : [] };
    banners.set(msg, entry);
  }

  // A small "Report" button after each flagged link in the body (the links
  // themselves are not touched).
  // result.links[i] is the verdict for data.links[i].
  function addInlineReports(msg, data, result) {
    const body = first(site.body, msg);
    if (!body) return [];
    const flagged = new Map();
    data.links.forEach(({ url }, i) => {
      const v = result.links?.[i];
      if (v && canReport(v)) flagged.set(url, v);
    });
    if (!flagged.size) return [];
    const hosts = [];
    for (const a of body.querySelectorAll('a[href]')) {
      const v = flagged.get(httpHref(a));
      if (!v) continue;
      const { host, root } = inlineShadow(a);
      const view = renderInlineReport(v, { onOpen: safe((b) => openLinkReport(b, v), 'report link') });
      for (const type of ['click', 'mousedown', 'keydown']) view.addEventListener(type, (e) => e.stopPropagation());
      root.append(view);
      hosts.push(host);
      if (hosts.length >= 50) break;
    }
    return hosts;
  }

  function removeEntry(entry) {
    if (!entry) return;
    entry.host?.remove();
    for (const h of entry.extras || []) h.remove();
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
      start(settings) {
        if (banners) return;
        reportOn = settings?.reportButton !== false;
        banners = new Map();
        const run = debounce(safe(scanMessages, 'gmail scan'), SCAN_DEBOUNCE_MS);
        bannerMo = new MutationObserver(run);
        bannerMo.observe(document.documentElement, { childList: true, subtree: true });
        run();
        debug(`${site.id}: banner started`);
      },
      // reportButton switched: draw the banners again with or without buttons.
      update(settings) {
        const want = settings?.reportButton !== false;
        if (!banners || want === reportOn) return;
        this.stop();
        this.start(settings);
      },
      stop() {
        if (!banners) return;
        bannerMo.disconnect();
        for (const entry of banners.values()) removeEntry(entry);
        banners = null;
        destroyReportPopover();
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
