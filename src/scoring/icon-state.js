// Maps a page verdict to the toolbar icon state and title. Pure.

import { translate } from '../config/strings/index.js';

export const ICON_STATES = ['normal', 'green', 'orange', 'red'];

const STATE_BY_TIER = { none: 'green', suspicious: 'orange', high: 'red', malicious: 'red' };

// verdict: pipeline verdict ({ tier, ... }) or null/undefined when the page
// was not checked. Anything unrecognised falls back to "normal".
function knownTier(verdict) {
  const tier = verdict?.tier;
  return typeof tier === 'string' && Object.hasOwn(STATE_BY_TIER, tier) ? tier : null;
}

export function iconStateForVerdict(verdict) {
  const tier = knownTier(verdict);
  return tier ? STATE_BY_TIER[tier] : 'normal';
}

// lang: interface language ('en', 'kn'); unknown -> English.
export function iconTitleForVerdict(verdict, lang = 'en') {
  return translate(lang, `toolbar.${knownTier(verdict) || 'normal'}`);
}

// Icon paths from the extension root, keyed by size, for the toolbar action.
// The leading "/" matters: relative paths resolve against the calling
// script's folder (src/background/) and fail to load.
export function iconPaths(state) {
  const s = ICON_STATES.includes(state) ? state : 'normal';
  return Object.fromEntries([16, 32, 48].map((n) => [n, `/icons/state/${s}-${n}.png`]));
}
