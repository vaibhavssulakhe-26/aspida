// Known URL shortener. Signal only: we never expand or follow the link,
// because that would contact the shortener with the user's URL.

import { signal } from './signal.js';
import { SHORTENERS } from '../config/lists.js';

export const id = 'shortener';

export function check({ url }) {
  if (!SHORTENERS.has(url.host) && !SHORTENERS.has(url.registrable)) return [];
  return [signal('shortener.known', 'shortener', url.host, `${url.host} is a link shortener; the real destination is hidden`)];
}
