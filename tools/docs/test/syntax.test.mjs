import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyRenderedSyntax } from '../lib/syntax.mjs';

test('rendered declarations accept members and reject malformed type syntax', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-docs-syntax-'));
  try {
    const page = join(root, 'api.md');
    writeFileSync(page, '```ts\nresolve<T>(key: T): T;\n```\n\n```ts\ntype Mode = "auto" | "raw";\n```');
    assert.equal(verifyRenderedSyntax(root), 2);
    writeFileSync(page, '```ts\nfromClass: <M = ed acqu>() => M;\n```');
    assert.throws(() => verifyRenderedSyntax(root), /api.md: invalid TypeScript/);
    writeFileSync(page, '```ts\nreadonly optional cleanupError?: unknown;\n```');
    assert.throws(() => verifyRenderedSyntax(root), /invalid TypeScript/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
