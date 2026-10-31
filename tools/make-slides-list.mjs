// Writes slides/slides.json: the slide*.png files in slides/, in numeric
// order (an extension page cannot list a folder). Dev tool, not shipped.
// Run after adding or removing slides: npm run slides
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';

const dir = new URL('../slides/', import.meta.url);
mkdirSync(dir, { recursive: true });
const slides = readdirSync(dir)
  .map((f) => [f, /^slide(\d+)\.png$/i.exec(f)])
  .filter(([, m]) => m)
  .sort((a, b) => Number(a[1][1]) - Number(b[1][1]))
  .map(([f]) => f);
writeFileSync(new URL('slides.json', dir), `${JSON.stringify(slides, null, 2)}\n`);
console.log(`wrote slides/slides.json (${slides.length} slides)`);
