// tools/graph/test/pack.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

const directory = resolve(import.meta.dirname, '..');

test('the package contains only the CLI, the library, and its documents', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, result.stderr);
  const [pack] = JSON.parse(result.stdout);
  assert.equal(pack.name, 'di-bag-graph');
  assert.deepEqual(pack.files.map(file => file.path).sort(), ['LICENSE', 'README.md', 'cli.mjs', 'lib/extract.mjs', 'package.json']);
  // npm marks bin targets executable in the archive.
  assert.equal(pack.files.find(file => file.path === 'cli.mjs').mode & 0o111, 0o111);
});
