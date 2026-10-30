import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildReference, parseDomainList } from '../src/core/reference.js';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const readData = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

export const TOP = parseDomainList(readData('data/top-domains.txt'));

export function makeCtx(opts = {}) {
  return buildReference({ topDomains: TOP, ...opts });
}
