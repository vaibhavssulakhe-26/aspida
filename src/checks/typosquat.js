// Typosquatting: the registrable domain's name is a small edit or a visual
// swap (rn->m, 0->o, 1->l) away from a well-known domain.
//
// Also exported: findLookalike(registrable, ctx), reused by sender checks.

import { signal } from './signal.js';
import { domainLabel } from '../core/url.js';
import { isWellKnown } from '../core/reference.js';
import { asciiSkeleton } from '../core/confusables.js';

export const id = 'typosquat';

// Optimal-string-alignment distance (Levenshtein + adjacent transposition),
// with early exit once the distance exceeds `max`.
export function editDistance(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

// Allowed distance for a target name of this length. Short names get no
// fuzzy matching at all; there are too many legitimate near neighbours.
// Fuzzy (edit-distance) matching only targets the most popular names and
// brand domains; the long tail of the top-10k list has too many legitimate
// near neighbours. Visual swaps are checked against the whole list.
const FUZZY_RANK_LIMIT = 500;

function maxDistanceFor(len) {
  if (len < 6) return 0;
  if (len < 12) return 1;
  return 2;
}

// Returns { kind: 'visual' | 'edit', target, distance } or null.
export function findLookalike(registrable, ctx) {
  if (!ctx || isWellKnown(ctx, registrable)) return null;
  const label = domainLabel(registrable);
  if (label.length < 4) return null;
  // Strip hyphens for comparison: "pay-pal" vs "paypal".
  const plain = label.replace(/-/g, '');

  // 1. Visual swap: skeletons equal, strings differ.
  const skel = asciiSkeleton(plain);
  if (skel !== label && ctx.labelOwners.has(skel)) {
    if (skel !== plain) return { kind: 'visual', target: ctx.labelOwners.get(skel), distance: 0 };
    // Hyphen-only difference ("pay-pal") is an edit, and like other edits
    // only counts against popular names ("my-portfolio" is not a squat).
    if (ctx.labelRank.get(skel) <= FUZZY_RANK_LIMIT) {
      return { kind: 'edit', target: ctx.labelOwners.get(skel), distance: 1 };
    }
  }

  // 2. Small edit distance against popular names of comparable length.
  // A name that is itself popular ("google" on .as) is not a typo of a
  // neighbour; brand-claim handles same-name-other-TLD cases.
  if (ctx.labelOwners.has(label) || ctx.labelOwners.has(plain)) return null;
  let best = null;
  for (let len = plain.length - 2; len <= plain.length + 2; len++) {
    const max = maxDistanceFor(len);
    if (max === 0 || Math.abs(len - plain.length) > max) continue;
    const bucket = ctx.labelsByLength.get(len);
    if (!bucket) continue;
    for (const target of bucket) {
      if (target === label || target === plain) continue;
      if (ctx.labelRank.get(target) > FUZZY_RANK_LIMIT) continue;
      // Cheap filter: names this similar share their first or last char.
      if (target[0] !== plain[0] && target[len - 1] !== plain[plain.length - 1]) continue;
      const d = editDistance(plain, target, max);
      if (d <= max && (!best || d < best.distance)) {
        best = { kind: 'edit', target: ctx.labelOwners.get(target), distance: d };
        if (d === 1) break;
      }
    }
    if (best?.distance === 1) break;
  }
  return best;
}

export function check({ url }, ctx) {
  if (url.isIp) return [];
  const hit = findLookalike(url.registrable, ctx);
  if (!hit) return [];
  if (hit.kind === 'visual') {
    return [signal('typosquat.visual_swap', 'lookalike', url.registrable, `"${url.registrable}" is visually similar to "${hit.target}"`)];
  }
  return [signal('typosquat.edit_distance', 'lookalike', url.registrable, `"${url.registrable}" is a ${hit.distance <= 1 ? 'one-character' : 'small'} misspelling of "${hit.target}"`)];
}
