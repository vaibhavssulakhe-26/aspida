// Guards for the offline demo pages and the demo server, so they behave the
// same on Linux (case-sensitive files, localhost -> ::1, python's 0.0.0.0
// link) as on Windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listenLoopback } from '../tools/demo-server.mjs';
import { DEMO_HOSTS } from '../src/content/sites/demo-hosts.js';
import demoChat from '../src/content/sites/demo-chat.selectors.js';
import demoGmail from '../src/content/sites/demo-gmail.selectors.js';
import gmailSite from '../src/content/sites/gmail.selectors.js';
import { matchesGmail } from '../src/content/gmail.js';

const demoDir = fileURLToPath(new URL('../demo/', import.meta.url));
const pages = readdirSync(demoDir).filter((f) => f.endsWith('.html'));

// Local references: href/src attributes plus quoted asset paths in inline scripts.
function localRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/['"`]\/?([\w./-]+\.(?:html|png|svg|js|css))['"`]/g)) refs.add(m[1]);
  return [...refs].filter((r) => r && !/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(r)).map((r) => r.split(/[?#]/)[0].replace(/^\//, ''));
}

// Exact-case existence check, segment by segment (existsSync would pass on
// case-insensitive Windows/macOS file systems).
function existsExactCase(rel) {
  let dir = demoDir;
  for (const seg of rel.split('/').filter(Boolean)) {
    if (!readdirSync(dir).includes(seg)) return false;
    dir = path.join(dir, seg);
  }
  return statSync(dir).isFile() || readdirSync(dir).includes('index.html');
}

test('every local reference in demo/*.html exists with exact case', () => {
  assert.ok(pages.length >= 5);
  for (const page of pages) {
    const refs = localRefs(readFileSync(path.join(demoDir, page), 'utf8'));
    for (const ref of refs) assert.ok(existsExactCase(ref), `${page} references missing file "${ref}" (check case)`);
  }
});

test('demo site modules activate on every loopback host name the demo can be opened on', () => {
  for (const url of ['http://localhost:8080/', 'http://127.0.0.1:8080/', 'http://[::1]:8080/', 'http://0.0.0.0:8080/']) {
    const { hostname } = new URL(url);
    assert.ok(DEMO_HOSTS.includes(hostname), `${hostname} missing from DEMO_HOSTS`);
  }
  assert.equal(demoChat.hosts, DEMO_HOSTS);
  assert.equal(demoGmail.hosts, DEMO_HOSTS);
});

test('demo server: loopback on IPv4 and IPv6, correct MIME types, exact-case paths, no traversal', async () => {
  const servers = await listenLoopback(0);
  try {
    const port = servers[0].address().port;
    const hosts = ['127.0.0.1', ...(servers.length > 1 ? ['[::1]'] : [])];
    for (const host of hosts) {
      const get = (p) => fetch(`http://${host}:${port}${p}`);
      for (const [p, type] of [['/', 'text/html'], ['/index.html', 'text/html'], ['/qr.html', 'text/html'], ['/qr/qr-feed.png', 'image/png']]) {
        const r = await get(p);
        assert.equal(r.status, 200, `${host} ${p}`);
        assert.ok(r.headers.get('content-type').startsWith(type), `${p}: ${r.headers.get('content-type')}`);
      }
      assert.equal((await get('/Index.html')).status, 404);
      assert.equal((await get('/%2e%2e/package.json')).status, 404);
      assert.equal((await get('/qr/qr-upi.png?cors')).headers.get('access-control-allow-origin'), '*');
    }
  } finally {
    for (const s of servers) s.close();
  }
});

test('the Gmail module runs on both offline mail demos and on real Gmail only', () => {
  const at = (url) => new URL(url);
  for (const u of ['http://localhost:8080/gmail-mock.html', 'http://127.0.0.1:8080/mail.html', 'http://[::1]:8080/mail.html#kyc', 'http://0.0.0.0:8080/mail.html']) {
    assert.ok(matchesGmail(demoGmail, at(u)), u);
  }
  for (const u of ['http://localhost:8080/', 'http://localhost:8080/chat-mock.html', 'https://mail.example/mail.html', 'https://mail.google.com/mail/u/0/']) {
    assert.ok(!matchesGmail(demoGmail, at(u)), u);
  }
  assert.ok(matchesGmail(gmailSite, at('https://mail.google.com/mail/u/0/#inbox')));
  assert.ok(!matchesGmail(gmailSite, at('http://localhost:8080/mail.html')));
});

test('demo mailbox keeps the DOM contract the Gmail selectors read', () => {
  assert.ok([].concat(demoGmail.pathPrefix).includes('/mail.html'), 'demo Gmail config must cover /mail.html');
  // The demo reuses the real selectors, so checking against them checks both.
  assert.deepEqual(demoGmail.inboxRow, gmailSite.inboxRow);
  assert.deepEqual(demoGmail.inboxSender, gmailSite.inboxSender);
  assert.ok(gmailSite.inboxRow.includes('tr.zA'));
  assert.ok(gmailSite.inboxSender.includes('span.yP[email]'));
  for (const sel of ['div.adn', 'h3.iw span[email]', 'span.gD[email]', 'table.ajC tr', 'div.a3s']) {
    assert.ok([...gmailSite.message, ...gmailSite.sender, ...gmailSite.detailRows, ...gmailSite.body].includes(sel), `selector ${sel} still in gmail.selectors.js`);
  }

  const html = readFileSync(path.join(demoDir, 'mail.html'), 'utf8');
  const rows = [...html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)].filter((m) => /\bclass="[^"]*\bzA\b/.test(m[1]));
  assert.equal(rows.length, 6, 'six inbox rows (tr.zA)');
  for (const [, attrs, inner] of rows) {
    const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
    const sender = /<span\b(?=[^>]*\bclass="[^"]*\byP\b)(?=[^>]*\bemail="([^"]+@[^"]+)")(?=[^>]*\bname="([^"]+)")[^>]*>/.exec(inner);
    assert.ok(sender, `${id}: needs span.yP with email and name attributes`);
    assert.ok(isReservedHost(sender[1].split('@')[1]), `${id}: sender domain must be reserved`);
    const tpl = new RegExp(`<template id="mail-${/data-mail="([^"]+)"/.exec(attrs)[1]}">([\\s\\S]*?)</template>`).exec(html);
    assert.ok(tpl, `${id}: has an email template`);
    assert.match(tpl[1], /<div class="adn\b/, `${id}: opened mail uses div.adn`);
    assert.match(tpl[1], /<h3 class="iw"><span class="gD" email="[^"]+" name="[^"]+"/, `${id}: h3.iw span.gD[email][name]`);
    assert.match(tpl[1], /<div class="a3s">/, `${id}: body in div.a3s`);
  }
  assert.match(html, /<table class="ajC">/, 'one email shows the details table (Reply-To)');
  assert.doesNotMatch(html, /Turn on <strong>Gmail: inbox highlighting|Synthetic emails only|Back to the demo/, "removed hint/footer text stays removed");
  assert.doesNotMatch(html, /\bGoogle\b|<input[^>]+type="password"/i, 'no Google branding, no sign-in form');
});

// Reserved names (RFC 2606/6761) and documentation-only IPs (RFC 5737):
// none of them can reach a real site.
function isReservedHost(host) {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || /\.(test|invalid|example|localhost)$/.test(h)) return true;
  if (/^(.+\.)?example\.(com|net|org)$/.test(h)) return true;
  return /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/.test(h);
}

test('demo sample links never point at a real site; real-site controls are labelled and grouped last', () => {
  for (const page of pages) {
    const html = readFileSync(path.join(demoDir, page), 'utf8');
    // Anchors in markup only; links built by scripts are checked below.
    const markup = html.replace(/<script>[\s\S]*?<\/script>/g, (m) => ' '.repeat(m.length));
    const marker = markup.indexOf('data-controls');
    for (const m of markup.matchAll(/<a\b([^>]*)>/g)) {
      const href = /\bhref\s*=\s*"([^"]*)"/.exec(m[1])?.[1] || '';
      if (!/^https?:/i.test(href)) continue;
      const control = /\bdata-control\s*=\s*"real"/.test(m[1]);
      const where = `${page}: ${href}`;
      if (control) {
        assert.ok(marker !== -1 && m.index > marker, `${where}: control link must sit in the data-controls group`);
      } else {
        assert.ok(isReservedHost(new URL(href).hostname), `${where}: sample link must use a reserved test domain (or mark it data-control="real")`);
        assert.ok(marker === -1 || m.index < marker, `${where}: sample link placed among the real-site controls`);
      }
    }
    // URLs built by inline scripts (heavy.html, chat "new message").
    for (const s of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      for (const u of s[1].matchAll(/https?:\/\/([^/"'`\s:]+)/g)) {
        assert.ok(isReservedHost(u[1].replace(/\$\{[^}]*\}/g, 'x')), `${page}: script builds a link to ${u[0]}`);
      }
    }
  }
});
