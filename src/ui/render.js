// The one renderer for verdicts. Tooltip, Gmail banner, chat badge, warning
// page and options page all call these functions with the pipeline's
// verdict shape, so wording and evidence citation are identical everywhere.
//
// Only textContent is used for data (no innerHTML): URLs and email text are
// attacker-controlled.
//
// Interface text comes from t() in the language set with setLanguage()
// (src/config/strings/). Reason sentences from the checks stay in English.
// Colours follow the 'theme' setting (setTheme), see PALETTE below.

import { t, getLanguage } from '../config/strings/index.js';
import { canReport, reportableUrl, destinationUrl, wrongWarningText, REPORT_DESTINATIONS, reportableSender, canReportSender } from '../core/report.js';

export const TIER_ICON = { none: 'i', suspicious: '!', high: '!!', malicious: '✕' };

const tierLabel = (tier) => t(`tier.${tier}`);

// 'auto' (follow prefers-color-scheme), 'light' or 'dark'.
let theme = 'auto';
export function setTheme(value) {
  theme = value === 'light' || value === 'dark' ? value : 'auto';
  return theme;
}
export const getTheme = () => theme;

// Root of every rendered block carries lang (Kannada font stack) and the
// theme (colour variables, see themeCss).
function rootEl(doc, cls, tag = 'div') {
  const e = doc.createElement(tag);
  e.className = cls;
  e.lang = getLanguage();
  e.dataset.theme = theme;
  return e;
}

function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// verdict: { tier, label, subject, hostUnicode, reasons[], allowlisted }
// mode: 'tooltip' | 'banner' | 'page'
// report: { onOpen(button), label?, allowed? } adds a "Report this link"
// button (risky tiers only, unless allowed says otherwise).
export function renderVerdict(verdict, { mode = 'tooltip', doc = document, maxReasons = mode === 'tooltip' ? 3 : 20, title, report } = {}) {
  const root = rootEl(doc, `tl-verdict tl-tier-${verdict.tier} tl-mode-${mode}`);
  root.setAttribute('role', 'status');

  const head = el(doc, 'div', 'tl-head');
  head.append(el(doc, 'span', 'tl-icon', TIER_ICON[verdict.tier]), el(doc, 'span', 'tl-label', tierLabel(verdict.tier)));
  if (title || verdict.hostUnicode) head.append(el(doc, 'span', 'tl-host', title || verdict.hostUnicode));
  root.append(head);
  if (verdict.via) root.append(el(doc, 'p', 'tl-note', t('verdict.via', { via: verdict.via })));

  if (verdict.allowlisted) {
    root.append(el(doc, 'p', 'tl-note', t('verdict.allowlisted')));
    return root;
  }
  const reasons = verdict.reasons || [];
  if (reasons.length) {
    const list = el(doc, 'ul', 'tl-reasons');
    for (const r of reasons.slice(0, maxReasons)) {
      const li = el(doc, 'li', `tl-reason tl-cat-${r.category}`);
      li.append(el(doc, 'span', 'tl-detail', r.detail));
      if (r.evidence) {
        const ev = el(doc, 'code', 'tl-evidence', r.evidence);
        ev.title = t('verdict.evidenceTitle');
        li.append(ev);
      }
      list.append(li);
    }
    if (reasons.length > maxReasons) list.append(el(doc, 'li', 'tl-more', t('verdict.more', { n: reasons.length - maxReasons })));
    root.append(list);
  }
  for (const id of verdict.advice || []) root.append(el(doc, 'p', 'tl-note tl-advice', t(`advice.${id}`)));
  if (verdict.tier === 'none') root.append(el(doc, 'p', 'tl-note', t('verdict.noneNote')));
  if (report && (report.allowed ?? canReport(verdict))) {
    // In the header row, right under the link, so the pointer reaches it
    // without crossing the rest of the tooltip.
    const b = el(doc, 'button', 'tl-btn tl-report-open', report.label || t('report.button'));
    b.type = 'button';
    b.addEventListener('click', () => report.onOpen(b));
    head.append(b);
  }
  return root;
}

// "Report this link" confirm step. Shows the exact URL that would be
// reported; nothing is sent from here. Actions are callbacks so this stays
// rendering only:
//   copy(text) -> Promise<boolean>
//   open(dest, url) -> Promise<boolean>   dest: a core/report.js destination
//                                         id, or 'issue' (wrong warning)
//   close()
export function renderReportPanel(verdict, { copy, open, close, doc = document } = {}) {
  const root = rootEl(doc, `tl-verdict tl-tier-${verdict.tier} tl-report`);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', t('report.title'));
  const head = el(doc, 'div', 'tl-head');
  head.append(el(doc, 'span', 'tl-icon', TIER_ICON[verdict.tier]), el(doc, 'span', 'tl-label', t('report.title')));
  root.append(head, el(doc, 'p', 'tl-note', t('report.intro')));

  let url = reportableUrl(verdict.subject);
  const shown = el(doc, 'code', 'tl-evidence tl-report-url', url);
  shown.setAttribute('aria-label', t('report.urlLabel'));
  const strip = el(doc, 'input');
  strip.type = 'checkbox';
  strip.checked = true;
  strip.className = 'tl-report-strip';
  strip.addEventListener('change', () => {
    url = reportableUrl(verdict.subject, { strip: strip.checked });
    shown.textContent = url;
  });
  const stripLabel = el(doc, 'label', 'tl-check');
  stripLabel.append(strip, el(doc, 'span', '', t('report.strip')));
  root.append(el(doc, 'span', 'tl-qr-title', t('report.urlLabel')), shown, stripLabel);

  const status = el(doc, 'p', 'tl-note tl-report-status');
  status.setAttribute('role', 'status');
  const button = (text, cls, onClick) => {
    const b = el(doc, 'button', `tl-btn ${cls}`, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const copyNow = async (okKey) => {
    const ok = await copy(url);
    status.textContent = t(ok ? okKey : 'report.copyFailed');
    return ok;
  };
  const go = async (dest) => {
    // Forms that can't be prefilled get the URL on the clipboard first.
    if (!destinationUrl(dest, url)?.prefilled) await copyNow('report.copiedPaste');
    if (!(await open(dest, url))) status.textContent = t('report.openFailed');
  };

  const copyRow = el(doc, 'div', 'tl-actions');
  copyRow.append(button(t('report.copy'), 'tl-report-copy', () => copyNow('report.copied')));
  const dests = el(doc, 'div', 'tl-actions');
  for (const { id } of REPORT_DESTINATIONS) {
    const b = button(t(`report.${id}`), 'tl-report-dest', () => go(id));
    b.dataset.dest = id;
    dests.append(b);
  }
  root.append(copyRow, el(doc, 'span', 'tl-qr-title', t('report.opensTab')), dests, el(doc, 'p', 'tl-note', t('report.helpline')));

  const wrong = el(doc, 'div', 'tl-actions tl-report-wrong');
  wrong.append(
    el(doc, 'span', 'tl-qr-title', t('report.wrongTitle')),
    button(t('report.wrongIssue'), 'tl-report-issue', async () => {
      if (!(await open('issue', url))) status.textContent = t('report.openFailed');
    }),
    button(t('report.wrongCopy'), 'tl-report-wrongcopy', async () => {
      const ok = await copy(wrongWarningText(url, verdict));
      status.textContent = t(ok ? 'report.wrongCopied' : 'report.copyFailed');
    }),
  );
  root.append(wrong, status);
  if (close) {
    const bar = el(doc, 'div', 'tl-actions tl-report-closebar');
    bar.append(button(t('report.close'), 'tl-report-close', () => close()));
    root.append(bar);
  }
  return root;
}

// "Report sender" confirm step (opened email). Shows the sender address and
// display name; Copy copies the address; destination buttons open the
// reporting site's plain form in a new tab (after copying the address).
// links: stripped URLs to offer with their own Copy buttons (used when the
// user reports an email Aspida found nothing wrong with).
//   copy(text) -> Promise<boolean>; open(dest) -> Promise<boolean>; close()
export function renderSenderReportPanel(verdict, sender, { copy, open, close, links = [], doc = document } = {}) {
  const who = reportableSender(sender);
  const root = rootEl(doc, `tl-verdict tl-tier-${verdict.tier} tl-report tl-report-sender`);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', t('report.title'));
  const head = el(doc, 'div', 'tl-head');
  head.append(el(doc, 'span', 'tl-icon', TIER_ICON[verdict.tier]), el(doc, 'span', 'tl-label', t('report.title')));
  root.append(head, el(doc, 'p', 'tl-note', t('report.senderIntro')));
  if (!who) return root;
  const shown = el(doc, 'code', 'tl-evidence tl-report-url tl-report-address', who.address);
  shown.setAttribute('aria-label', t('report.senderLabel'));
  root.append(el(doc, 'span', 'tl-qr-title', t('report.senderLabel')), shown);
  if (who.displayName) root.append(el(doc, 'p', 'tl-note tl-report-name', t('report.senderName', { name: who.displayName })));

  const status = el(doc, 'p', 'tl-note tl-report-status');
  status.setAttribute('role', 'status');
  const button = (text, cls, onClick) => {
    const b = el(doc, 'button', `tl-btn ${cls}`, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const copyNow = async (okKey) => {
    const ok = await copy(who.address);
    status.textContent = t(ok ? okKey : 'report.copyFailed');
    return ok;
  };
  const copyRow = el(doc, 'div', 'tl-actions');
  copyRow.append(button(t('report.copyAddress'), 'tl-report-copy', () => copyNow('report.addressCopied')));
  const dests = el(doc, 'div', 'tl-actions');
  for (const { id } of REPORT_DESTINATIONS) {
    const b = button(t(`report.${id}`), 'tl-report-dest', async () => {
      await copyNow('report.addressCopiedPaste');
      if (!(await open(id))) status.textContent = t('report.openFailed');
    });
    b.dataset.dest = id;
    dests.append(b);
  }
  root.append(copyRow);
  if (links.length) {
    const list = el(doc, 'ul', 'tl-report-links');
    for (const url of links) {
      const li = el(doc, 'li', 'tl-report-link');
      li.append(
        el(doc, 'code', 'tl-evidence', url),
        button(t('report.copy'), 'tl-report-linkcopy', async () => {
          status.textContent = t((await copy(url)) ? 'report.copied' : 'report.copyFailed');
        }),
      );
      list.append(li);
    }
    root.append(el(doc, 'span', 'tl-qr-title', t('report.linksTitle')), list);
  }
  root.append(el(doc, 'span', 'tl-qr-title', t('report.opensTab')), dests, el(doc, 'p', 'tl-note', t('report.helpline')), status);
  if (close) {
    const bar = el(doc, 'div', 'tl-actions tl-report-closebar');
    bar.append(button(t('report.close'), 'tl-report-close', () => close()));
    root.append(bar);
  }
  return root;
}

// Small "Report" button placed right after a flagged link in an email body.
export function renderInlineReport(verdict, { onOpen, doc = document } = {}) {
  const root = rootEl(doc, `tl-inline tl-tier-${verdict.tier}`, 'span');
  const b = el(doc, 'button', 'tl-inline-report', t('report.inline'));
  b.type = 'button';
  b.setAttribute('aria-label', t('report.inlineLabel', { url: verdict.subject }));
  b.title = t('report.title');
  b.addEventListener('click', () => onOpen(b));
  root.append(b);
  return root;
}

// Small inline pill next to a chat link. Text is the tier label.
export function renderBadge(verdict, { doc = document } = {}) {
  const b = rootEl(doc, `tl-badge tl-tier-${verdict.tier}`, 'span');
  b.append(el(doc, 'span', 'tl-icon', TIER_ICON[verdict.tier]), el(doc, 'span', 'tl-badge-text', tierLabel(verdict.tier)));
  return b;
}

// Gmail banner: combined summary + sender verdict + flagged links.
// result: { summary: {tier,label,count}, sender, links: verdict[] }
// Optional callbacks (each adds a button):
//   onReportSender(button)     "Report sender" (Suspicious / High sender only;
//                              senderInfo: { address, displayName })
//   onReportLink(verdict, button)  "Report this link" on flagged links
//   onMinimize(button)         "Minimize" (any warning tier)
//   onReportMissed(button)     "Think this is suspicious? Report" (no-warning
//                              emails; the caller decides when to offer it)
export function renderEmailBanner(result, { doc = document, notes = [], senderInfo, onReportSender, onReportLink, onMinimize, onReportMissed } = {}) {
  const { summary, sender, links } = result;
  const root = rootEl(doc, `tl-verdict tl-tier-${summary.tier} tl-mode-banner`);
  const head = el(doc, 'div', 'tl-head');
  head.append(el(doc, 'span', 'tl-icon', TIER_ICON[summary.tier]), el(doc, 'span', 'tl-label', t('banner.title', { label: tierLabel(summary.tier) })));
  const linkList = (links || []).filter(Boolean);
  head.append(el(doc, 'span', 'tl-host', linkList.length === 1 ? t('banner.checkedOne') : t('banner.checkedMany', { n: linkList.length })));
  if (onMinimize && summary.tier !== 'none') {
    const m = el(doc, 'button', 'tl-btn tl-minimize', t('banner.minimize'));
    m.type = 'button';
    m.setAttribute('aria-expanded', 'true');
    m.setAttribute('aria-label', t('banner.minimizeLabel'));
    m.addEventListener('click', () => onMinimize(m));
    head.append(m);
  }
  root.append(head);

  if (sender && sender.tier !== 'none') {
    const report = onReportSender ? { label: t('report.senderButton'), allowed: canReportSender(sender, senderInfo), onOpen: (b) => onReportSender(b) } : null;
    const s = renderVerdict(sender, { mode: 'banner', doc, title: t('banner.sender', { address: sender.subject }), report });
    s.classList.add('tl-sub', 'tl-sub-sender');
    root.append(s);
  }
  for (const v of linkList.filter((x) => x.tier !== 'none').slice(0, 5)) {
    const report = onReportLink ? { onOpen: (b) => onReportLink(v, b) } : null;
    const s = renderVerdict(v, { mode: 'banner', doc, maxReasons: 3, title: v.subject.length > 80 ? `${v.subject.slice(0, 80)}…` : v.subject, report });
    s.classList.add('tl-sub');
    root.append(s);
  }
  if (summary.tier === 'none') root.append(el(doc, 'p', 'tl-note', t('verdict.noneNote')));
  if (onReportMissed && summary.tier === 'none') {
    const row = el(doc, 'div', 'tl-actions tl-missed');
    const b = el(doc, 'button', 'tl-btn tl-report-missed', t('report.missedButton'));
    b.type = 'button';
    b.setAttribute('aria-label', t('report.missedLabel'));
    b.addEventListener('click', () => onReportMissed(b));
    row.append(el(doc, 'span', 'tl-missed-q', t('report.missedQuestion')), b);
    root.append(row);
  }
  for (const n of notes) root.append(el(doc, 'p', 'tl-note tl-limit', n));
  return root;
}

// Minimized banner: a small coloured pill that expands it again.
export function renderEmailPill(summary, { onExpand, doc = document } = {}) {
  const root = rootEl(doc, `tl-pillwrap tl-tier-${summary.tier}`);
  const b = el(doc, 'button', 'tl-pill');
  b.type = 'button';
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', t('banner.pillLabel', { label: tierLabel(summary.tier) }));
  b.append(el(doc, 'span', 'tl-icon', TIER_ICON[summary.tier]), el(doc, 'span', 'tl-pill-text', t('banner.pill', { label: tierLabel(summary.tier) })));
  b.addEventListener('click', () => onExpand(b));
  root.append(b);
  return root;
}

// QR tooltip. qr: classifyQrText() result; verdict: pipeline verdict for a
// URL payload, or for the domain-like part of a text payload (qr.maybeUrl),
// or null. Shows the payload as written (a bare domain without the scheme
// added for analysis). Without qr, renders a short "could not read" note.
export function renderQr({ qr, verdict }, { doc = document } = {}) {
  if (!qr) {
    const root = rootEl(doc, 'tl-verdict tl-tier-none tl-mode-tooltip');
    const head = el(doc, 'div', 'tl-head');
    head.append(el(doc, 'span', 'tl-icon', 'i'), el(doc, 'span', 'tl-label', t('qr.notChecked')));
    root.append(head, el(doc, 'p', 'tl-note', t('qr.unreadable')));
    return root;
  }
  const wrap = el(doc, 'div', 'tl-qr');
  const shown = el(doc, 'div', 'tl-qr-payload');
  shown.append(el(doc, 'span', 'tl-qr-title', t('qr.contains')), el(doc, 'code', 'tl-evidence', qr.type === 'url' ? qr.display || qr.url : qr.text));
  if ((qr.type === 'url' || qr.maybeUrl) && verdict) {
    const v = renderVerdict(verdict, { mode: 'tooltip', doc });
    if (qr.type !== 'url') shown.append(el(doc, 'p', 'tl-note', t('qr.maybeLink', { host: qr.host })));
    v.prepend(shown);
    wrap.append(v);
    return wrap;
  }
  const root = rootEl(doc, 'tl-verdict tl-tier-none tl-mode-tooltip');
  const head = el(doc, 'div', 'tl-head');
  head.append(el(doc, 'span', 'tl-icon', 'i'), el(doc, 'span', 'tl-label', t(qr.type === 'upi' ? 'qr.upiTitle' : 'qr.textTitle')));
  root.append(shown, head);
  if (qr.type === 'upi') {
    const list = el(doc, 'ul', 'tl-reasons');
    const row = (k, v) => {
      const li = el(doc, 'li', 'tl-reason');
      li.append(el(doc, 'span', 'tl-detail', k), el(doc, 'code', 'tl-evidence', v || t('qr.notGiven')));
      list.append(li);
    };
    row(t('qr.upiPayee'), qr.payee);
    row(t('qr.upiName'), qr.name);
    if (qr.amount) row(t('qr.upiAmount'), `${qr.amount} ${qr.currency}`);
    root.append(list, el(doc, 'p', 'tl-note', t('qr.upiNote')));
  }
  return root;
}

// ---- Colours ----------------------------------------------------------------
// Palette "Clean Blue" (navy #1D3557, teal #A8DADC, light grey #E9ECEF,
// white) for every in-page panel, the warning page included. This is the one
// place the values live; themeCss() turns them into CSS variables for light,
// dark, and 'auto' (prefers-color-scheme). Risk colours stay semantic: green
// (no known threats), yellow (Suspicious), red (High risk / Known malicious).
// Every text colour here is >= 4.5:1 on the panel it is used on (WCAG AA),
// tier labels also on their tint; accents are >= 3:1. Panels are opaque.
// Only the hover tooltips (links, QR) carry a coloured accent edge; every
// other panel has a plain 1px neutral border and shows severity with the
// icon and a tinted label.
const PALETTE = {
  light: {
    bg: '#ffffff', bg2: '#e9ecef', fg: '#1d3557', muted: '#4a5b73', border: '#a8dadc', control: '#4f7480',
    hover: '#d8eeef', primary: '#1d3557', 'primary-fg': '#ffffff', focus: '#1d3557', shadow: 'rgba(29, 53, 87, 0.22)',
    'none-accent': '#17733a', 'none-text': '#17733a', 'none-icon': '#17733a', 'none-icon-fg': '#ffffff',
    'suspicious-accent': '#b58300', 'suspicious-text': '#7a5300', 'suspicious-icon': '#f2c94c', 'suspicious-icon-fg': '#1d3557',
    'high-accent': '#d32f2f', 'high-text': '#b42318', 'high-icon': '#d32f2f', 'high-icon-fg': '#ffffff',
    'malicious-accent': '#9b1c1c', 'malicious-text': '#9b1c1c', 'malicious-icon': '#9b1c1c', 'malicious-icon-fg': '#ffffff',
    'none-tint': '#dfebe3', 'suspicious-tint': '#fbf0cd', 'high-tint': '#f9e2e2', 'malicious-tint': '#f1dfdf',
  },
  dark: {
    bg: '#1d3557', bg2: '#14253d', fg: '#e9ecef', muted: '#b9c6d2', border: '#4d7a87', control: '#7fa9b0',
    hover: '#2c4256', primary: '#a8dadc', 'primary-fg': '#1d3557', focus: '#a8dadc', shadow: 'rgba(0, 0, 0, 0.45)',
    'none-accent': '#7ee2a0', 'none-text': '#7ee2a0', 'none-icon': '#7ee2a0', 'none-icon-fg': '#1d3557',
    'suspicious-accent': '#f2c94c', 'suspicious-text': '#f2c94c', 'suspicious-icon': '#f2c94c', 'suspicious-icon-fg': '#1d3557',
    'high-accent': '#ff8a80', 'high-text': '#ff9b91', 'high-icon': '#ff8a80', 'high-icon-fg': '#1d3557',
    'malicious-accent': '#ff7b72', 'malicious-text': '#ff8a80', 'malicious-icon': '#ff7b72', 'malicious-icon-fg': '#1d3557',
    'none-tint': '#294a60', 'suspicious-tint': '#374756', 'high-tint': '#383f5c', 'malicious-tint': '#383d5a',
  },
};
export const PALETTE_COLORS = PALETTE; // for tests

const cssVars = (map) => Object.entries(map).map(([k, v]) => `--tl-${k}: ${v};`).join(' ');

// Variables for the elements matched by `selector` (a comma list). The theme
// comes from a data-theme attribute on those elements ('light' / 'dark';
// anything else follows the system).
export function themeCss(selector) {
  const list = selector.split(',').map((x) => x.trim());
  const each = (suffix) => list.map((x) => x + suffix).join(', ');
  const dark = `${cssVars(PALETTE.dark)} color-scheme: dark;`;
  return `${list.join(', ')} { ${cssVars(PALETTE.light)} color-scheme: light; }
@media (prefers-color-scheme: dark) { ${each(':not([data-theme="light"])')} { ${dark} } }
${each('[data-theme="dark"]')} { ${dark} }
`;
}

// Styles for all of the above. Injected into each Shadow root / page.
export const VERDICT_CSS = `${themeCss('.tl-verdict, .tl-badge, .tl-inline, .tl-pillwrap')}
.tl-verdict, .tl-badge, .tl-inline, .tl-pillwrap {
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--tl-fg); box-sizing: border-box; text-align: left; letter-spacing: normal; text-transform: none; font-style: normal;
}
/* Kannada interface: local fonts only (no web fonts are loaded). */
.tl-verdict:lang(kn), .tl-badge:lang(kn), .tl-inline:lang(kn), .tl-pillwrap:lang(kn) { font-family: "Noto Sans Kannada", "Nirmala UI", "Tunga", "Kedage", system-ui, sans-serif; line-height: 1.55; }
.tl-verdict { background: var(--tl-bg); border: 1px solid var(--tl-border); border-radius: 8px; padding: 10px 12px; }
/* Hover tooltips only: coloured accent edge. */
.tl-mode-tooltip { border-left: 4px solid var(--tl-accent); }
/* Elsewhere: the tier label is a tinted badge. */
.tl-verdict:not(.tl-mode-tooltip) > .tl-head > .tl-label { padding: 0 8px; border-radius: 10px; background: var(--tl-tint); }
.tl-tier-none { --tl-tint: var(--tl-none-tint); --tl-accent: var(--tl-none-accent); --tl-label: var(--tl-none-text); --tl-icon-bg: var(--tl-none-icon); --tl-icon-fg: var(--tl-none-icon-fg); }
.tl-tier-suspicious { --tl-tint: var(--tl-suspicious-tint); --tl-accent: var(--tl-suspicious-accent); --tl-label: var(--tl-suspicious-text); --tl-icon-bg: var(--tl-suspicious-icon); --tl-icon-fg: var(--tl-suspicious-icon-fg); }
.tl-tier-high { --tl-tint: var(--tl-high-tint); --tl-accent: var(--tl-high-accent); --tl-label: var(--tl-high-text); --tl-icon-bg: var(--tl-high-icon); --tl-icon-fg: var(--tl-high-icon-fg); }
.tl-tier-malicious { --tl-tint: var(--tl-malicious-tint); --tl-accent: var(--tl-malicious-accent); --tl-label: var(--tl-malicious-text); --tl-icon-bg: var(--tl-malicious-icon); --tl-icon-fg: var(--tl-malicious-icon-fg); }
.tl-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tl-icon { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; background: var(--tl-icon-bg); color: var(--tl-icon-fg); font-weight: 700; font-size: 11px; box-sizing: border-box; }
.tl-label { font-weight: 650; color: var(--tl-label); }
.tl-host { color: var(--tl-muted); overflow-wrap: anywhere; font-size: 12px; }
.tl-reasons { margin: 8px 0 0; padding: 0 0 0 18px; }
.tl-reason { margin: 4px 0; }
.tl-detail { display: block; }
.tl-evidence { display: inline-block; margin-top: 2px; padding: 1px 6px; border-radius: 4px; background: var(--tl-bg2); color: var(--tl-fg); border: 1px solid var(--tl-border); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; max-width: 100%; box-sizing: border-box; }
.tl-more, .tl-note { color: var(--tl-muted); font-size: 12px; }
.tl-note { margin: 8px 0 0; }
.tl-mode-tooltip { max-width: 360px; box-shadow: 0 8px 24px var(--tl-shadow); }
.tl-qr-payload { margin: 0 0 8px; padding: 0 0 8px; border-bottom: 1px solid var(--tl-border); }
.tl-qr-title { display: block; color: var(--tl-muted); font-size: 12px; }
.tl-mode-banner { margin: 0 0 12px; }
/* Findings inside the email banner: no box, just spacing and a thin divider. */
.tl-sub { margin: 10px 0 0; padding: 10px 0 0; border: 0; border-top: 1px solid var(--tl-border); border-radius: 0; background: transparent; }
.tl-mode-page { padding: 16px 18px; font-size: 15px; }
.tl-mode-page .tl-icon { min-width: 26px; height: 26px; border-radius: 13px; font-size: 13px; }
.tl-mode-page .tl-label { font-size: 18px; }
.tl-badge { display: inline-flex; align-items: center; gap: 4px; margin: 0 4px; padding: 1px 6px 1px 2px; border-radius: 10px; background: var(--tl-bg); border: 1px solid var(--tl-accent); color: var(--tl-label); font-size: 11px; font-weight: 600; vertical-align: middle; cursor: help; white-space: nowrap; }
.tl-badge .tl-icon { min-width: 16px; height: 16px; font-size: 10px; }
.tl-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0 0; }
/* Buttons: secondary = teal tint, navy text; destinations = primary (navy). */
.tl-btn { font: inherit; font-size: 12px; line-height: 1.3; padding: 4px 10px; border: 1px solid var(--tl-border); border-radius: 6px; background: var(--tl-hover); color: var(--tl-fg); cursor: pointer; margin: 0; text-transform: none; }
.tl-btn:hover { border-color: var(--tl-control); }
.tl-report-dest { background: var(--tl-primary); border-color: var(--tl-primary); color: var(--tl-primary-fg); font-weight: 600; }
.tl-report-dest:hover { border-color: var(--tl-fg); }
.tl-btn:focus-visible, .tl-check input:focus-visible, .tl-pill:focus-visible, .tl-inline-report:focus-visible { outline: 2px solid var(--tl-focus); outline-offset: 1px; }
.tl-report-open { margin-left: auto; padding: 2px 8px; font-weight: 600; }
.tl-minimize { margin-left: auto; padding: 2px 8px; }
.tl-report-open + .tl-minimize { margin-left: 0; }
.tl-report { max-width: 400px; }
.tl-mode-tooltip.tl-report, .tl-float .tl-report { box-shadow: 0 8px 24px var(--tl-shadow); }
.tl-report-url { display: block; margin: 2px 0 6px; user-select: all; }
.tl-check { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--tl-muted); cursor: pointer; }
.tl-check input { margin: 2px 0 0; accent-color: var(--tl-primary); }
.tl-report-wrong { border-top: 1px solid var(--tl-border); padding-top: 8px; }
.tl-report-wrong .tl-qr-title { flex-basis: 100%; }
.tl-report-status:empty { display: none; }
.tl-report-closebar { justify-content: flex-end; }
.tl-report-links { list-style: none; margin: 2px 0 0; padding: 0; }
.tl-report-link { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
.tl-report-link .tl-evidence { flex: 1 1 auto; min-width: 0; margin: 0; }
.tl-report-link .tl-btn { flex: none; padding: 2px 8px; }
/* "Think this is suspicious? Report" on no-warning emails: small, secondary. */
.tl-missed { font-size: 12px; color: var(--tl-muted); }
.tl-report-missed { padding: 2px 8px; }
/* Inline "Report" after a flagged link in an email body: small, no layout change. */
.tl-inline { display: inline; white-space: nowrap; }
.tl-inline-report { display: inline-block; vertical-align: baseline; margin: 0 0 0 4px; padding: 0 6px; font: 600 11px/16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; border: 1px solid var(--tl-border); border-radius: 8px; background: var(--tl-tint); color: var(--tl-fg); cursor: pointer; text-transform: none; letter-spacing: normal; }
.tl-inline-report:hover { border-color: var(--tl-control); }
.tl-inline:lang(kn) .tl-inline-report { font-family: "Noto Sans Kannada", "Nirmala UI", "Tunga", "Kedage", system-ui, sans-serif; }
/* Minimized email banner. */
.tl-pillwrap { display: block; margin: 0 0 12px; }
.tl-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px 3px 4px; border: 1px solid var(--tl-border); border-radius: 14px; background: var(--tl-tint); color: var(--tl-label); font: inherit; font-weight: 650; cursor: pointer; }
.tl-pill:hover { border-color: var(--tl-control); }
/* Expand / minimize: short fade-and-lift, opacity and transform only. */
.tl-enter { animation: tl-enter 160ms ease-out; }
@keyframes tl-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .tl-enter { animation: none; } }
`;
