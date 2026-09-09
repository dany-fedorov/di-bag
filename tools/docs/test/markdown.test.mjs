import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compareTrees, rewriteMarkdownLinks } from '../lib/markdown.mjs';

test('hosted Markdown links stay local, while repository files link to GitHub', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-docs-links-'));
  try {
    mkdirSync(join(root, 'examples'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/index.ts'), 'export {};');
    writeFileSync(join(root, 'package.json'), '{}');
    const pages = new Map([
      ['README.md', 'index.md'],
      ['docs/guides/tutorial.md', 'guides/tutorial.md'],
      ['docs/reference/index.md', 'reference/index.md'],
    ]);
    const source = '[Intro](../../README.md#quickstart) [API](../reference/index.md) '
      + '[Code](../../src/index.ts) [Examples](../../examples) [Here](#scopes) '
      + '[External](https://example.com/guide)';
    const actual = rewriteMarkdownLinks(source, 'docs/guides/tutorial.md', pages, root);
    assert.equal(actual, '[Intro](../index.md#quickstart) [API](../reference/index.md) '
      + '[Code](https://github.com/dany-fedorov/di-bag/blob/main/src/index.ts) '
      + '[Examples](https://github.com/dany-fedorov/di-bag/tree/main/examples) '
      + '[Here](#scopes) [External](https://example.com/guide)');
    const fence = '```md\n[Literal](../../missing.md)\n```';
    assert.equal(rewriteMarkdownLinks(fence, 'docs/guides/tutorial.md', pages, root), fence);
    assert.equal(rewriteMarkdownLinks('[![Badge](https://example.com/badge.svg)](package.json)', 'README.md', pages, root),
      '[![Badge](https://example.com/badge.svg)](https://github.com/dany-fedorov/di-bag/blob/main/package.json)');
    assert.throws(() => rewriteMarkdownLinks('[Broken](missing.md)', 'docs/guides/tutorial.md', pages, root), /missing.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('generated reference drift detects new, modified, and obsolete files', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-docs-drift-'));
  const expected = join(root, 'generated');
  const actual = join(root, 'checked-in');
  try {
    mkdirSync(expected);
    mkdirSync(actual);
    for (const dir of [expected, actual]) writeFileSync(join(dir, 'same.md'), '# Same\n');
    assert.deepEqual(compareTrees(expected, actual), []);
    writeFileSync(join(expected, 'new.md'), '# New API\n');
    writeFileSync(join(actual, 'obsolete.md'), '# Removed API\n');
    writeFileSync(join(actual, 'same.md'), '# Stale signature\n');
    assert.deepEqual(compareTrees(expected, actual), [
      'missing: new.md', 'obsolete: obsolete.md', 'changed: same.md',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
