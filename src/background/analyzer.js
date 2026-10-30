// Glue between the pure pipeline and the extension: loads reference data,
// asks the feed manager for local hits, runs the pipeline, counts stats.

import { analyzeUrl, analyzeSender, combine } from '../core/pipeline.js';
import { buildReference, parseDomainList } from '../core/reference.js';
import { registrableDomain, unwrapRedirect } from '../core/url.js';
import { lookup } from './feed-manager.js';
import { getLocal, setLocal, getSession, setSession } from '../platform/storage.js';
import { extensionUrl } from '../platform/browser.js';

// Read-only cache of the reference context for this worker lifetime. Not
// state: it is rebuilt from the packaged list + storage on every wake, and
// dropped whenever the allowlist changes.
let ctxPromise = null;

export function invalidateContext() {
  ctxPromise = null;
}

async function loadContext() {
  const [text, allowlist] = await Promise.all([
    fetch(extensionUrl('data/top-domains.txt')).then((r) => r.text()),
    getLocal('allowlist', []),
  ]);
  return buildReference({ topDomains: parseDomainList(text), allowlist });
}

export function getContext() {
  if (!ctxPromise) ctxPromise = loadContext().catch((e) => ((ctxPromise = null), Promise.reject(e)));
  return ctxPromise;
}

export async function analyzeOne(rawUrl, linkText) {
  const ctx = await getContext();
  const hits = await lookup(unwrapRedirect(rawUrl)?.url || rawUrl);
  return analyzeUrl(rawUrl, ctx, hits, { linkText });
}

export const MAX_BATCH = 500;

// items: Array<string | { url, text }>. Returns verdicts in the same order
// (null for non-http(s) or invalid entries). Capped at MAX_BATCH.
export async function analyzeMany(items) {
  const out = [];
  for (const item of items.slice(0, MAX_BATCH)) {
    const url = typeof item === 'string' ? item : item?.url;
    const text = typeof item === 'string' ? undefined : typeof item?.text === 'string' ? item.text.slice(0, 300) : undefined;
    out.push(typeof url === 'string' ? await analyzeOne(url, text) : null);
  }
  await countFlagged(out);
  return out;
}

export async function analyzeEmail({ sender, links = [] }) {
  const ctx = await getContext();
  let senderVerdict = null;
  if (sender?.address) {
    const domain = sender.address.split('@').pop();
    senderVerdict = analyzeSender(sender, ctx, await lookup(`https://${domain}/`));
  }
  const linkVerdicts = await analyzeMany(links);
  const all = [senderVerdict, ...linkVerdicts];
  await countFlagged([senderVerdict]);
  return { sender: senderVerdict, links: linkVerdicts, summary: combine(all) };
}

// Inbox rows: sender-only verdicts, same order as input.
export async function analyzeSenders(items) {
  const ctx = await getContext();
  const out = [];
  for (const s of items.slice(0, MAX_BATCH)) {
    const domain = typeof s?.address === 'string' ? s.address.split('@').pop() : '';
    out.push(domain ? analyzeSender(s, ctx, await lookup(`https://${domain}/`)) : null);
  }
  await countFlagged(out);
  return out;
}

// ---- local stats --------------------------------------------------------
// Counters only; no URLs are kept. A session-scoped set of hashed subjects
// prevents the same link being counted on every hover / re-render.

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function bumpStat(name, by = 1) {
  const stats = await getLocal('stats', {});
  stats[name] = (stats[name] || 0) + by;
  await setLocal('stats', stats);
}

async function countFlagged(verdicts) {
  const flagged = verdicts.filter((v) => v && v.tier !== 'none');
  if (!flagged.length) return;
  const seen = new Set(await getSession('countedSubjects', []));
  const stats = await getLocal('stats', {});
  let changed = false;
  for (const v of flagged) {
    const h = await hash(`${v.kind}|${v.subject}`);
    if (seen.has(h)) continue;
    seen.add(h);
    stats[v.tier] = (stats[v.tier] || 0) + 1;
    changed = true;
  }
  if (!changed) return;
  await setLocal('stats', stats);
  await setSession('countedSubjects', [...seen].slice(-2000));
}

export function allowlistKeyFor(rawUrlOrHost) {
  try {
    return registrableDomain(new URL(rawUrlOrHost).hostname);
  } catch {
    return registrableDomain(String(rawUrlOrHost));
  }
}
