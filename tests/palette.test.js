// In-page palette (src/ui/render.js): WCAG AA contrast in both themes, and
// risk colours that stay red / yellow / green (never the palette's blue).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE_COLORS, themeCss, setTheme, getTheme } from '../src/ui/render.js';

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => {
  const [r, g, b] = rgb(h).map((c) => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const TIERS = ['none', 'suspicious', 'high', 'malicious'];

for (const name of ['light', 'dark']) {
  test(`${name} theme: text >= 4.5:1, borders/accents >= 3:1`, () => {
    const p = PALETTE_COLORS[name];
    const text = [['fg', 'bg'], ['fg', 'bg2'], ['muted', 'bg'], ['fg', 'hover'], ['primary-fg', 'primary']];
    for (const t of TIERS) text.push([`${t}-text`, 'bg'], [`${t}-icon-fg`, `${t}-icon`]);
    for (const [f, b] of text) assert.ok(ratio(p[f], p[b]) >= 4.5, `${name}: ${f} on ${b} = ${ratio(p[f], p[b]).toFixed(2)}`);
    for (const t of TIERS) assert.ok(ratio(p[`${t}-accent`], p.bg) >= 3, `${name}: ${t}-accent border`);
    assert.ok(ratio(p.focus, p.bg) >= 3, `${name}: focus ring`);
  });
}

test('panels use the Clean Blue palette; risk colours keep their hue', () => {
  assert.equal(PALETTE_COLORS.light.fg, '#1d3557');
  assert.equal(PALETTE_COLORS.dark.bg, '#1d3557');
  assert.equal(PALETTE_COLORS.light.border, '#a8dadc');
  const hue = (h) => {
    const [r, g, b] = rgb(h).map((c) => c / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (x * 60 + 360) % 360;
  };
  for (const name of ['light', 'dark']) {
    const p = PALETTE_COLORS[name];
    for (const k of ['high', 'malicious']) for (const part of ['accent', 'text']) { const h = hue(p[`${k}-${part}`]); assert.ok(h < 15 || h > 345, `${name} ${k}-${part} is red`); }
    for (const part of ['accent', 'text', 'icon']) { const h = hue(p[`suspicious-${part}`]); assert.ok(h > 35 && h < 55, `${name} suspicious-${part} is yellow (${h})`); }
    for (const part of ['accent', 'text']) { const h = hue(p[`none-${part}`]); assert.ok(h > 100 && h < 160, `${name} none-${part} is green`); }
  }
});

test('theme: one variables block, light/dark/auto selectors', () => {
  const css = themeCss('.a, .b');
  assert.match(css, /^\.a, \.b \{ --tl-bg: #ffffff;/);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{ \.a:not\(\[data-theme="light"\]\), \.b:not\(\[data-theme="light"\]\) \{ --tl-bg: #1d3557;/);
  assert.match(css, /\.a\[data-theme="dark"\], \.b\[data-theme="dark"\] \{ --tl-bg: #1d3557;/);
  try {
    assert.equal(setTheme('dark'), 'dark');
    assert.equal(setTheme('nonsense'), 'auto');
    assert.equal(getTheme(), 'auto');
  } finally {
    setTheme('auto');
  }
});
