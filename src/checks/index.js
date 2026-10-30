// Check registry: the single extension point for new detections.
// To add a check: create a pure module exporting `id` and
// `check(input, ctx) -> Signal[]`, add its signal ids to
// src/scoring/weights.js, and list it below. Nothing else changes.

import * as feedMatch from './feed-match.js';
import * as urlStructure from './url-structure.js';
import * as shortener from './shortener.js';
import * as typosquat from './typosquat.js';
import * as homoglyphIdn from './homoglyph-idn.js';
import * as brandClaim from './brand-claim.js';
import * as senderChecks from './sender-checks.js';
import * as linkText from './link-text.js';
import * as software from './software.js';

// Run on every URL. input: { url: ParsedUrl, feedHits, linkText? }
export const URL_CHECKS = [feedMatch, urlStructure, shortener, typosquat, homoglyphIdn, brandClaim, linkText, software];

// Run on an email sender. input: { displayName, address, replyTo }
export const SENDER_CHECKS = [senderChecks];
