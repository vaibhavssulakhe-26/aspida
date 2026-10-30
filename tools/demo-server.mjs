// Tiny static server for demo/ (no dependencies). Used by `npm run demo`
// and by the smoke test. Loopback only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const demoRoot = fileURLToPath(new URL('../demo/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };

export function createDemoServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let p = path.normalize(path.join(demoRoot, decodeURIComponent(url.pathname)));
      if (!p.startsWith(demoRoot)) throw new Error('outside demo/');
      if (p.endsWith(path.sep)) p = path.join(p, 'index.html');
      const body = await readFile(p);
      // ?cors adds CORS headers (used to exercise the worker's image fetch).
      const cors = url.searchParams.has('cors') ? { 'access-control-allow-origin': '*' } : {};
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store', ...cors }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });
}

// CLI: node tools/demo-server.mjs [port]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8080);
  createDemoServer().listen(port, '127.0.0.1', () => {
    console.log(`TrustLens demo: http://localhost:${port}/  (also http://127.0.0.1:${port}/)`);
  });
  // Also answer on IPv6 loopback so "localhost" works whichever address Chrome picks.
  createDemoServer().listen(port, '::1').on('error', () => {});
}
