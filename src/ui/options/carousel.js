// Circular navbar maths for the settings page (whole-item positions; the
// continuous idle motion is src/core/belt.js). Pure: no DOM, no chrome.*.
// Items form a loop; the selected item sits at offset 0, the others at signed
// offsets to its left (negative) and right (positive).

export const wrapIndex = (i, n) => ((i % n) + n) % n;

// Index reached from `selected` after `delta` steps (wraps both ways).
export const step = (selected, delta, n) => wrapIndex(selected + delta, n);

// Signed position of item i relative to the selected one, in
// (-n/2, n/2]: for six items, -2..3 (the opposite item counts as +3).
export function offset(i, selected, n) {
  const d = wrapIndex(i - selected, n);
  return d > n / 2 ? d - n : d;
}

// Offsets of all items, in item order.
export const offsets = (selected, n) => Array.from({ length: n }, (_, i) => offset(i, selected, n));

// Item indexes shown with `reach` neighbours each side, left to right.
export function visibleOrder(selected, n, reach) {
  const r = Math.min(reach, Math.floor((n - 1) / 2));
  return Array.from({ length: 2 * r + 1 }, (_, k) => step(selected, k - r, n));
}
