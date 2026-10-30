// The one renderer for verdicts. Tooltip, Gmail banner, chat badge, warning
// page and options page all call these functions with the pipeline's
// verdict shape, so wording and evidence citation are identical everywhere.
//
// Only textContent is used for data (no innerHTML): URLs and email text are
// attacker-controlled.
//
// Interface text comes from t() in the language set with setLanguage()
// (src/config/strings/). Reason sentences from the checks stay in English.

import { t, getLanguage } from '../config/strings/index.js';

export const TIER_ICON = { none: 'i', suspicious: '!', high: '!!', malicious: '✕' };

const tierLabel = (tier) => t(`tier.${tier}`);

// Root of every rendered block carries lang, so the Kannada font stack applies.
function rootEl(doc, cls) {
  const e = doc.createElement('div');
  e.className = cls;
  e.lang = getLanguage();
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
export function renderVerdict(verdict, { mode = 'tooltip', doc = document, maxReasons = mode === 'tooltip' ? 3 : 20, title } = {}) {
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
  return root;
}

// Small inline pill next to a chat link. Text is the tier label.
export function renderBadge(verdict, { doc = document } = {}) {
  const b = el(doc, 'span', `tl-badge tl-tier-${verdict.tier}`);
  b.lang = getLanguage();
  b.append(el(doc, 'span', 'tl-icon', TIER_ICON[verdict.tier]), el(doc, 'span', 'tl-badge-text', tierLabel(verdict.tier)));
  return b;
}

// Gmail banner: combined summary + sender verdict + flagged links.
// result: { summary: {tier,label,count}, sender, links: verdict[] }
export function renderEmailBanner(result, { doc = document, notes = [] } = {}) {
  const { summary, sender, links } = result;
  const root = rootEl(doc, `tl-verdict tl-tier-${summary.tier} tl-mode-banner`);
  const head = el(doc, 'div', 'tl-head');
  head.append(el(doc, 'span', 'tl-icon', TIER_ICON[summary.tier]), el(doc, 'span', 'tl-label', t('banner.title', { label: tierLabel(summary.tier) })));
  const linkList = (links || []).filter(Boolean);
  head.append(el(doc, 'span', 'tl-host', linkList.length === 1 ? t('banner.checkedOne') : t('banner.checkedMany', { n: linkList.length })));
  root.append(head);

  if (sender && sender.tier !== 'none') {
    const s = renderVerdict(sender, { mode: 'banner', doc, title: t('banner.sender', { address: sender.subject }) });
    s.classList.add('tl-sub');
    root.append(s);
  }
  for (const v of linkList.filter((x) => x.tier !== 'none').slice(0, 5)) {
    const s = renderVerdict(v, { mode: 'banner', doc, maxReasons: 3, title: v.subject.length > 80 ? `${v.subject.slice(0, 80)}…` : v.subject });
    s.classList.add('tl-sub');
    root.append(s);
  }
  if (summary.tier === 'none') root.append(el(doc, 'p', 'tl-note', t('verdict.noneNote')));
  for (const n of notes) root.append(el(doc, 'p', 'tl-note tl-limit', n));
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

// Styles for all of the above. Injected into each Shadow root / page.
export const VERDICT_CSS = `
.tl-verdict, .tl-badge {
  --tl-bg: #ffffff; --tl-fg: #1f2328; --tl-muted: #59636e; --tl-border: #d0d7de; --tl-code: #f6f8fa;
  --tl-none: #3b6fb6; --tl-suspicious: #b26b00; --tl-high: #c2410c; --tl-malicious: #b91c1c;
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--tl-fg); box-sizing: border-box; text-align: left; letter-spacing: normal;
}
@media (prefers-color-scheme: dark) {
  .tl-verdict, .tl-badge {
    --tl-bg: #161b22; --tl-fg: #e6edf3; --tl-muted: #9198a1; --tl-border: #3d444d; --tl-code: #0d1117;
    --tl-none: #6ea8fe; --tl-suspicious: #e3a008; --tl-high: #fb923c; --tl-malicious: #f87171;
  }
}
/* Kannada interface: local fonts only (no web fonts are loaded). */
.tl-verdict:lang(kn), .tl-badge:lang(kn) { font-family: "Noto Sans Kannada", "Nirmala UI", "Tunga", "Kedage", system-ui, sans-serif; line-height: 1.55; }
.tl-verdict { background: var(--tl-bg); border: 1px solid var(--tl-border); border-left: 4px solid var(--tl-accent); border-radius: 8px; padding: 10px 12px; }
.tl-tier-none { --tl-accent: var(--tl-none); }
.tl-tier-suspicious { --tl-accent: var(--tl-suspicious); }
.tl-tier-high { --tl-accent: var(--tl-high); }
.tl-tier-malicious { --tl-accent: var(--tl-malicious); }
.tl-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tl-icon { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; background: var(--tl-accent); color: #fff; font-weight: 700; font-size: 11px; box-sizing: border-box; }
.tl-label { font-weight: 650; color: var(--tl-accent); }
.tl-host { color: var(--tl-muted); overflow-wrap: anywhere; font-size: 12px; }
.tl-reasons { margin: 8px 0 0; padding: 0 0 0 18px; }
.tl-reason { margin: 4px 0; }
.tl-detail { display: block; }
.tl-evidence { display: inline-block; margin-top: 2px; padding: 1px 6px; border-radius: 4px; background: var(--tl-code); border: 1px solid var(--tl-border); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; max-width: 100%; box-sizing: border-box; }
.tl-more, .tl-note { color: var(--tl-muted); font-size: 12px; }
.tl-note { margin: 8px 0 0; }
.tl-mode-tooltip { max-width: 360px; box-shadow: 0 8px 24px rgba(0,0,0,.18); }
.tl-qr-payload { margin: 0 0 8px; padding: 0 0 8px; border-bottom: 1px solid var(--tl-border); }
.tl-qr-title { display: block; color: var(--tl-muted); font-size: 12px; }
.tl-mode-banner { margin: 0 0 12px; }
.tl-sub { margin: 8px 0 0; border-left-width: 3px; padding: 8px 10px; }
.tl-mode-page { padding: 16px 18px; font-size: 15px; }
.tl-mode-page .tl-icon { min-width: 26px; height: 26px; border-radius: 13px; font-size: 13px; }
.tl-mode-page .tl-label { font-size: 18px; }
.tl-badge { display: inline-flex; align-items: center; gap: 4px; margin: 0 4px; padding: 1px 6px 1px 2px; border-radius: 10px; background: var(--tl-bg); border: 1px solid var(--tl-accent); color: var(--tl-accent); font-size: 11px; font-weight: 600; vertical-align: middle; cursor: help; white-space: nowrap; }
.tl-badge .tl-icon { min-width: 16px; height: 16px; font-size: 10px; }
`;
