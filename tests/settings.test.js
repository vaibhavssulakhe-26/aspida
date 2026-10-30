import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, mergeSettings } from '../src/config/settings.js';

test('verdicts appear on hover only by default: inline chat badges are opt-in', () => {
  assert.equal(DEFAULT_SETTINGS.hoverVerdict, true);
  assert.equal(DEFAULT_SETTINGS.chatInlineBadges, false);
  // Existing installs without the key get the default too.
  assert.equal(mergeSettings({ chatWhatsApp: true }).chatInlineBadges, false);
});
