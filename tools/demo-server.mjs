// Tiny static server for demo/ (no dependencies). Used by `npm run demo`
// and by the smoke test. Loopback only.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const demoRoot = fileURLToPath(new URL('../demo/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };

// Paths must match file names exactly, as on Linux, so a case mismatch in a
// demo page fails on Windows/macOS too instead of only on Linux.
async function assertExactCase(p) {
  let dir = demoRoot;
  for (const seg of path.relative(demoRoot, p).split(path.sep)) {
    if (!(await readdir(dir)).includes(seg)) throw new Error(`no exact match for ${seg}`);
    dir = path.join(dir, seg);
  }
}

export function createDemoServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let p = path.normalize(path.join(demoRoot, decodeURIComponent(url.pathname)));
      if (!p.startsWith(demoRoot)) throw new Error('outside demo/');
      if (p.endsWith(path.sep)) p = path.join(p, 'index.html');
      await assertExactCase(p);
      const body = await readFile(p);
      // ?cors adds CORS headers (used to exercise the worker's image fetch).
      const cors = url.searchParams.has('cors') ? { 'access-control-allow-origin': '*' } : {};
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store', ...cors }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });
}

// Listen on both loopback addresses: "localhost" resolves to ::1 first on
// most Linux systems and to 127.0.0.1 elsewhere. Resolves to the servers once
// the IPv4 one is up; the IPv6 one is best effort (no IPv6 loopback: skipped).
export function listenLoopback(port) {
  const v4 = createDemoServer();
  const v6 = createDemoServer();
  return new Promise((resolve, reject) => {
    v4.once('error', reject);
    v4.listen(port, '127.0.0.1', () => {
      v6.once('error', () => resolve([v4]));
      v6.listen(v4.address().port, '::1', () => resolve([v4, v6]));
    });
  });
}

// CLI: node tools/demo-server.mjs [port]   (npm run demo -- [port])
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8080);
  try {
    const servers = await listenLoopback(port);
    const v6 = servers.length > 1 ? `, http://[::1]:${port}/` : '';
    console.log(`Aspida demo: http://localhost:${port}/  (also http://127.0.0.1:${port}/${v6})`);
  } catch (e) {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error(`Port ${port} is already in use (an earlier demo server or python http.server?).`);
    console.error(`Stop it, or pick another port: npm run demo -- ${port + 1}`);
    process.exit(1);
  }
}
