// tools/codemod/test/cli.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const packageRoot = resolve(import.meta.dirname, '..');
const cli = join(packageRoot, 'cli.mjs');
const run = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });

/** A private copy of a fixture project, so `--write` never touches the repository. */
function copyOf(directory) {
  const target = mkdtempSync(join(tmpdir(), 'di-bag-codemod-'));
  cpSync(join(import.meta.dirname, directory), target, { recursive: true });
  return target;
}

test('a dry run reports what it would rewrite and writes nothing', () => {
  const project = copyOf('fixtures');
  const before = readFileSync(join(project, 'build-and-start/input.ts'), 'utf8');
  const result = run(project, '--project', 'tsconfig.json');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /would rewrite build-and-start\/input\.ts: \d+ rewrites/);
  assert.match(result.stdout, /manual build-and-start\/input\.ts:17:\d+ startupOrder is not a literal/);
  assert.match(result.stdout, /\d+ files, \d+ rewrites, \d+ manual items \(dry run; pass --write to apply\) \(TypeScript \d+\.\d+\.\d+, (project|bundled)\)\n$/);
  assert.equal(readFileSync(join(project, 'build-and-start/input.ts'), 'utf8'), before);
  rmSync(project, { recursive: true, force: true });
});

test('--write applies the shipped map and --report lists files and manual items', () => {
  const project = copyOf('fixtures');
  const report = join(project, 'report.json');
  const result = run(project, '--write', '--report', report);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rewrote build-and-start\/input\.ts/);
  assert.equal(readFileSync(join(project, 'build-and-start/input.ts'), 'utf8'), readFileSync(join(project, 'build-and-start/expected.ts'), 'utf8'));
  const written = JSON.parse(readFileSync(report, 'utf8'));
  assert.equal(written.version, 1);
  assert.equal(written.written, true);
  assert.ok(written.files.some(entry => entry.file === 'build-and-start/input.ts' && entry.rewrites > 0));
  assert.ok(written.manual.every(item => typeof item.file === 'string' && typeof item.line === 'number' && typeof item.reason === 'string'));
  rmSync(project, { recursive: true, force: true });
});

test('--map selects another rename map', () => {
  const project = copyOf('fixtures');
  const result = run(project, '--map', 'array-argument/map.json', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(project, 'array-argument/input.ts'), 'utf8'), readFileSync(join(project, 'array-argument/expected.ts'), 'utf8'));
  rmSync(project, { recursive: true, force: true });
});

test('without --library-root only node_modules/di-bag counts as the library', () => {
  const project = copyOf('library-root-fixture');
  const result = run(project, '--project', 'tsconfig.json');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^0 files, 0 rewrites, 0 manual items/m);
  rmSync(project, { recursive: true, force: true });
});

test('--library-root rewrites callers of a checked-out library and never the library itself', () => {
  const project = copyOf('library-root-fixture');
  const library = readFileSync(join(project, 'src/index.ts'), 'utf8');
  const result = run(project, '--project', 'tsconfig.json', '--library-root', 'src', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(project, 'src/index.ts'), 'utf8'), library);
  assert.equal(readFileSync(join(project, 'app/main.ts'), 'utf8'), [
    "import { Builder } from '../src/index.js';",
    '',
    'export async function main(signal: AbortSignal) {',
    "  const bag = await new Builder().build().ensureServicesReady(['db'], { abortSignal: signal, totalTimeoutMs: 5 });",
    '  await bag.close({ waitTimeoutMs: 10 });',
    '}',
    '',
  ].join('\n'));
  assert.match(readFileSync(join(project, 'app/excluded/extra.ts'), 'utf8'), /buildAndStart/);
  rmSync(project, { recursive: true, force: true });
});

test('--extra-files adds files the tsconfig excludes', () => {
  const project = copyOf('library-root-fixture');
  const result = run(project, '--project', 'tsconfig.json', '--library-root', 'src', '--extra-files', 'app/excluded/*.ts', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(project, 'app/excluded/extra.ts'), 'utf8'), /new Builder\(\)\.build\(\)\.ensureServicesReady\(\['db'\]\)/);
  rmSync(project, { recursive: true, force: true });
});

test('--project and positional files are rejected before --write can change a file', () => {
  const project = copyOf('library-root-fixture');
  const file = join(project, 'app/main.ts');
  const before = readFileSync(file, 'utf8');
  const result = run(project, '--project', 'tsconfig.json', 'app/main.ts', '--write');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--project cannot be used with positional files/);
  assert.equal(readFileSync(file, 'utf8'), before);
  rmSync(project, { recursive: true, force: true });
});

test('positional files remain a supported input mode', () => {
  const project = copyOf('library-root-fixture');
  const result = run(project, '--library-root', 'src', 'app/main.ts', '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(project, 'app/main.ts'), 'utf8'), /new Builder\(\)\.build\(\)\.ensureServicesReady\(\['db'\]/);
  rmSync(project, { recursive: true, force: true });
});

test('usage errors exit 2', () => {
  const project = copyOf('library-root-fixture');
  assert.equal(run(project, '--projct', 'x').status, 2);
  assert.equal(run(project, '--project').status, 2);
  const missing = run(project, '--project', 'missing.json');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /missing\.json/);
  const badMap = run(project, '--map', 'package.json');
  assert.equal(badMap.status, 2);
  assert.match(badMap.stderr, /invalid rename map/);
  rmSync(project, { recursive: true, force: true });
});
