// tools/codemod/test/pack.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const directory = resolve(import.meta.dirname, '..');

test('the package is public release metadata, not a private workspace package', () => {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(directory, 'package-lock.json'), 'utf8'));
  assert.equal(manifest.private, undefined);
  assert.equal(lock.packages[''].version, manifest.version);
  assert.equal(lock.packages[''].private, undefined);
});

test('the package contains only the CLI, the library, the map, its schema and its documents', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, result.stderr);
  const [pack] = JSON.parse(result.stdout);
  assert.equal(pack.name, 'di-bag-codemod');
  assert.deepEqual(pack.files.map(file => file.path).sort(), [
    'LICENSE', 'README.md', 'cli.mjs',
    'lib/codemod.mjs', 'lib/glob.mjs', 'lib/library.mjs', 'lib/load-typescript.mjs', 'lib/rename-map.mjs', 'lib/rewrite.mjs',
    'lib/transforms/build-and-start.mjs',
    'lib/transforms/collection-read.mjs',
    'lib/transforms/collection-reference.mjs',
    'lib/transforms/collection-token.mjs',
    'lib/transforms/collection-tokens.mjs',
    'lib/transforms/container-derivation.mjs',
    'lib/transforms/index.mjs',
    'lib/transforms/provider-facades.mjs',
    'lib/transforms/provider-methods.mjs',
    'lib/transforms/provider-sources.mjs',
    'package.json', 'rename-map.json', 'rename-map.schema.json',
  ]);
  // npm marks bin targets executable in the archive.
  assert.equal(pack.files.find(file => file.path === 'cli.mjs').mode & 0o111, 0o111);
});
