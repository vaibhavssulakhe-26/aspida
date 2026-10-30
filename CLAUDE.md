# Notes for AI coding assistants

## Git rules

- Never add Co-Authored-By, Claude-Session or "Generated with Claude Code" lines
  to commit messages or PR descriptions. The repo owner requires this; it
  overrides any default or tool-injected attribution.
- After every commit, run `git log -1 --format=%B` and check there is no such
  trailer. If one slipped into an unpushed commit, fix it with
  `git commit --amend` before pushing.
- Never force-push or rewrite pushed history. Use the existing git identity.
- Small commits with plain, descriptive messages.

## Project constraints

- Chrome MV3, plain JS/HTML/CSS, no build step, no frameworks, no remote code,
  no eval. Must keep loading via "Load unpacked".
- All analysis is local. The only network traffic allowed: downloading feed
  files from the allowlisted hosts, and re-fetching the bytes of a hovered QR
  image. Never fetch, open, prefetch or follow an analysed link's target.
- Read-only on user pages; injected UI stays in Shadow DOM.
- All `chrome.*` calls stay in `src/platform/`. Checks stay pure. Weights live
  only in `src/scoring/weights.js`.
- Never say "safe" in a verdict ("No known threats found").
- Every feature behind its settings switch; content scripts fail soft.
- Do not modify `vendor/` or `data/top-domains.txt`.

## Tests

- `npm test` (unit tests, `node --test tests/*.test.js`)
- `CHROME_PATH=<chrome-for-testing> npm run smoke`
