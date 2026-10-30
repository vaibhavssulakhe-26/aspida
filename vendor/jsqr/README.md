# jsQR 1.4.0 (vendored)

- Source: https://www.npmjs.com/package/jsqr (dist/jsQR.js, unmodified)
- Upstream: https://github.com/cozmo/jsQR
- License: Apache-2.0 (see LICENSE in this folder)

Loaded as a side-effect ES module import (`import '.../jsQR.js'`): its UMD
wrapper falls through to `root.jsQR = factory()` with `root = self`, which
defines `self.jsQR` in the service worker and in the content-script world.
