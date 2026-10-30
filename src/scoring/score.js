// Turns a list of signals into a verdict. The only place tiers are decided.

import { THRESHOLDS, MALICIOUS_CATEGORIES, TIER_LABELS, TIERS } from './weights.js';

// Returns { tier, label, score, reasons } where reasons are the signals,
// de-duplicated by id+evidence and sorted strongest first.
export function score(signals = []) {
  const seen = new Set();
  const reasons = [];
  for (const s of signals) {
    const key = `${s.id}|${s.evidence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reasons.push(s);
  }
  reasons.sort((a, b) => b.weight - a.weight);

  // Each signal id counts once toward the score, at its weight.
  const byId = new Map();
  for (const r of reasons) byId.set(r.id, Math.max(byId.get(r.id) ?? 0, r.weight));
  let total = 0;
  for (const w of byId.values()) total += w;
  const value = Math.min(100, total);

  let tier = 'none';
  if (reasons.some((r) => MALICIOUS_CATEGORIES.has(r.category))) tier = 'malicious';
  else if (value >= THRESHOLDS.high) tier = 'high';
  else if (value >= THRESHOLDS.suspicious) tier = 'suspicious';

  return { tier, label: TIER_LABELS[tier], score: value, reasons };
}

// Worst of several verdict tiers (e.g. an email's sender + all its links).
export function worstTier(tiers) {
  let worst = 0;
  for (const t of tiers) worst = Math.max(worst, TIERS.indexOf(t));
  return TIERS[worst];
}
