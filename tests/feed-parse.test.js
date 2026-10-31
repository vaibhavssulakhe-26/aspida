import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/core/feed-parse.js';
import { readData } from './helpers.js';

test('url-list: path URLs become url keys, bare-domain URLs become hosts', () => {
  const r = parseFeed('url-list', 'https://evil.com/login.php\nhttp://bad.top/\n\nnot a url\n# comment\nhttps://EVIL.com/login.php');
  assert.deepEqual(r.urls, ['evil.com/login.php']);
  assert.deepEqual(r.hosts, ['bad.top']);
});

test('domain-list: hostnames only, junk skipped', () => {
  const r = parseFeed('domain-list', 'evil.com\nSub.Evil.COM.\nfoo\n<html>\n');
  assert.deepEqual(r.hosts, ['evil.com', 'sub.evil.com']);
  assert.deepEqual(r.urls, []);
});

test('bundled sample feed parses and contains the demo hosts', () => {
  const r = parseFeed('mixed', readData('data/sample-feed.txt'));
  assert.ok(r.hosts.includes('malicious.aspida-demo.invalid'));
  assert.ok(r.urls.includes('login-verify.aspida-demo.invalid/hdfc/netbanking/login.php'));
});

test('garbage input never throws', () => {
  for (const f of ['url-list', 'domain-list', 'mixed']) {
    assert.doesNotThrow(() => parseFeed(f, '\u0000￿"""",,,\nhttp://[bad/\n'));
  }
});
