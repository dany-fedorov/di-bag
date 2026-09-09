import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyBuiltSite } from '../lib/site-check.mjs';

test('rendered-site checks catch broken fragments and incorrect Pages asset paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-site-check-'));
  try {
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'assets/app.js'), '');
    writeFileSync(join(root, 'guide.html'), '<h2 id="scope">Scope</h2>');
    writeFileSync(join(root, 'index.html'), '<a href="/di-bag/guide.html#scope">Guide</a><script src="/di-bag/assets/app.js"></script>');
    assert.deepEqual(verifyBuiltSite(root), { pages: 2, links: 2 });
    writeFileSync(join(root, 'index.html'), '<a href="/di-bag/guide.html#missing">Broken</a>');
    assert.throws(() => verifyBuiltSite(root), /missing anchor/);
    writeFileSync(join(root, 'index.html'), '<script src="/assets/app.js"></script>');
    assert.throws(() => verifyBuiltSite(root), /outside.*base/);
    writeFileSync(join(root, 'index.html'), '<img src="/di-bag/assets/missing.png">');
    assert.throws(() => verifyBuiltSite(root), /missing page or asset/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
