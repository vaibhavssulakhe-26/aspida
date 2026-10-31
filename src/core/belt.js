// Continuous navbar "conveyor" for the settings page idle mode. Pure maths:
// no DOM, no timers. Positions are in item units: position p means item p is
// exactly centred; p grows with time, so items move to the left.

export const ITEM_MS = 2000; // one item-width every 2 s
export const SPEED = 1 / ITEM_MS; // items per millisecond
export const MAX_DT_MS = 100; // longer frame gaps (tab switch, jank) are clamped
export const CENTRE_EASE_MS = 400; // click: ease to the item (ease-out)
export const RESUME_EASE_MS = 500; // idle again: speed ramps up (ease-in)

// Centre-to-centre distance from the middle, in slots, at whole offsets: the
// items are scaled, so equal steps would leave uneven gaps. Interpolated
// linearly in between (continuous and monotonic).
export const SLOT_POSITION = [0, 1.02, 1.92, 2.79, 3.66];

// Resting look (|distance| >= REST_AT) vs the centre (distance 0).
export const REST_AT = 1.5;
export const REST_SCALE = 0.8;
export const REST_OPACITY = 0.82;
// The highlight (fill) fades out over a shorter distance than the scale, so
// at rest the neighbours show no fill and the hand-over is quick; the light
// label switches in the middle of that fade (a narrow band), so the text is
// never a half-way mix of the dark and light label.
export const HIGHLIGHT_TO = 0.8;
export const LABEL_BAND = [0.35, 0.65];

export const wrapPosition = (p, n) => ((p % n) + n) % n;

// Signed shortest distance from position p to item i around a loop of n,
// in (-n/2, n/2]. Negative: the item is left of the centre.
export function loopDistance(i, p, n) {
  let d = wrapPosition(i - p, n);
  if (d > n / 2) d -= n;
  return d;
}

export const clampDt = (dt) => Math.min(Math.max(dt || 0, 0), MAX_DT_MS);

// Position after dt ms at full speed times factor (0..1, for the ease-in).
export const advance = (p, dt, n, factor = 1) => wrapPosition(p + clampDt(dt) * SPEED * factor, n);

const smooth = (x) => x * x * (3 - 2 * x); // smoothstep on 0..1
const nearness = (d) => 1 - smooth(Math.min(Math.abs(d), REST_AT) / REST_AT); // 1 at centre, 0 from REST_AT

// Scale for an item at distance d: 1 at the centre, REST_SCALE from REST_AT.
export const scaleFor = (d) => REST_SCALE + (1 - REST_SCALE) * nearness(d);

// Opacity of the highlight fill: 1 at the centre, 0 from HIGHLIGHT_TO.
export const highlightFor = (d) => 1 - smooth(Math.min(Math.abs(d), HIGHLIGHT_TO) / HIGHLIGHT_TO);

// Opacity of the light label on the fill: follows the fill, switching within LABEL_BAND.
export function labelFor(d) {
  const [lo, hi] = LABEL_BAND;
  return smooth(Math.min(Math.max((highlightFor(d) - lo) / (hi - lo), 0), 1));
}

// Item opacity: 1 at the centre, REST_OPACITY at rest, fading to 0 just
// outside the visible reach (so items wrap around the loop while invisible).
export function opacityFor(d, reach = 2) {
  const a = Math.abs(d);
  const base = REST_OPACITY + (1 - REST_OPACITY) * nearness(d);
  const fadeFrom = reach + 0.25;
  const goneAt = reach + 0.75;
  if (a <= fadeFrom) return base;
  if (a >= goneAt) return 0;
  return base * (1 - smooth((a - fadeFrom) / (goneAt - fadeFrom)));
}

// Horizontal offset in slots for distance d (piecewise linear in SLOT_POSITION).
export function slotX(d) {
  const a = Math.abs(d);
  const last = SLOT_POSITION.length - 1;
  const k = Math.min(Math.floor(a), last - 1);
  const x = SLOT_POSITION[k] + (SLOT_POSITION[k + 1] - SLOT_POSITION[k]) * (Math.min(a, last) - k);
  return Math.sign(d) * x;
}

// Position at which item i is centred, reached from p along the shortest path.
export const targetFor = (i, p, n) => p + loopDistance(i, p, n);

export const easeOutCubic = (t) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
export const easeInQuad = (t) => Math.min(Math.max(t, 0), 1) ** 2;

// Nearest item to the centre at position p.
export const nearestItem = (p, n) => wrapPosition(Math.round(p), n);
