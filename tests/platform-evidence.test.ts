import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  evaluatePlatformChild,
  packIsolatedClassic,
  stableJson,
  validatePackOutput,
  validatePackedArchive,
  verifyTool,
  writePlatformEvidence,
  type PlatformEnvironment,
  type PlatformTool,
} from '../scripts/platform-evidence.ts';

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-platform-test-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'tools'));
  return root;
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function tarArchive(files: Readonly<Record<string, string>>): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (const [path, contents] of Object.entries(files)) {
    const body = Buffer.from(contents);
    const header = Buffer.alloc(512);
    header.write(`package/${path}`, 0, 100, 'utf8');
    header.write('0000644\0', 100, 8, 'ascii');
    header.write('0000000\0', 108, 8, 'ascii');
    header.write('0000000\0', 116, 8, 'ascii');
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
    header.write('00000000000\0', 136, 12, 'ascii');
    header.fill(0x20, 148, 156);
    header.write('0', 156, 1, 'ascii');
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    chunks.push(Uint8Array.from(header), Uint8Array.from(body));
    const padding = (512 - body.length % 512) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(1024));
  return Uint8Array.from(gzipSync(Uint8Array.from(Buffer.concat(chunks))));
}

const expected = { lane: 'deno-root', result: { ok: true } };
const cleanChild: PlatformEnvironment = {
  status: 0,
  signal: null,
  stdout: `${JSON.stringify(expected)}\n`,
  stderr: '',
};

test('child evidence rejects noncanonical output, stderr, process failures and the wrong lane', () => {
  expect(evaluatePlatformChild(expected, cleanChild)).toEqual({ status: 'pass' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, stdout: `${JSON.stringify(expected)}\nnoise` }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, stdout: ` ${JSON.stringify(expected)}\n` }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, stderr: 'warning\n' }))
    .toEqual({ status: 'fail', reason: 'child stderr is not empty' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, status: 3 }))
    .toEqual({ status: 'fail', reason: 'child exited with status 3' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, status: null, signal: 'SIGKILL' }))
    .toEqual({ status: 'fail', reason: 'child terminated by SIGKILL' });
  expect(evaluatePlatformChild(expected, { ...cleanChild,
    stdout: `${JSON.stringify({ lane: 'browser-worker-minified', result: { ok: true } })}\n` }))
    .toEqual({ status: 'fail', reason: 'child lane mismatch' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, stdout: '{broken}\n' }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, stdout: `${JSON.stringify([expected])}\n` }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, stdout: JSON.stringify(expected) }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, stdout: `${JSON.stringify({ ...expected, result: { ok: false } })}\n` }))
    .toEqual({ status: 'fail', reason: 'child result mismatch' });
  expect(evaluatePlatformChild(expected, { ...cleanChild, status: null }))
    .toEqual({ status: 'fail', reason: 'child exited with status null' });
  expect(evaluatePlatformChild(expected, { ...cleanChild,
    stdout: '{"lane":"deno-root","result":{"ok":true},"__proto__":{"hostile":true}}\n' }))
    .toEqual({ status: 'fail', reason: 'child result mismatch' });
  expect(evaluatePlatformChild(expected, { ...cleanChild,
    stdout: '{"lane":"deno-root","result":{"ok":true,"__proto__":{"hostile":true}}}\n' }))
    .toEqual({ status: 'fail', reason: 'child result mismatch' });
});

test('tool verification rejects explicit unavailability, version drift and hash drift', async () => {
  const root = temporaryRoot();
  const script = join(root, 'version.js');
  const source = "console.log('deno 2.4.5')\n";
  writeFileSync(script, source);
  chmodSync(script, 0o755);
  const executable = realpathSync(process.execPath);
  const manifest = {
    schema: 1,
    deno: {
      status: 'pinned', argv: [executable, script], versionArgv: [executable, script, '--version'],
      version: '2.4.5', versionText: 'deno 2.4.5\n', sha256: hash(source),
    },
  };
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify(manifest));
  await expect(verifyTool(root, 'deno')).resolves.toMatchObject({ status: 'pinned', version: '2.4.5' });

  manifest.deno.versionText = 'deno 2.4.4\n';
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify(manifest));
  await expect(verifyTool(root, 'deno')).resolves.toEqual({ status: 'unavailable', reason: 'version-mismatch' });

  manifest.deno.versionText = 'deno 2.4.5\n';
  manifest.deno.sha256 = '0'.repeat(64);
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify(manifest));
  await expect(verifyTool(root, 'deno')).resolves.toEqual({ status: 'unavailable', reason: 'hash-mismatch' });

  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify({
    schema: 1, deno: { status: 'unavailable', reason: 'not-provisioned' },
  }));
  await expect(verifyTool(root, 'deno')).resolves.toEqual({ status: 'unavailable', reason: 'not-provisioned' });
});

test('tool verification rejects malformed pins and unavailable executables before a lane starts', async () => {
  const root = temporaryRoot();
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify({ schema: 1, deno: {
    status: 'pinned', argv: ['/missing/deno'], versionArgv: ['/missing/deno', '--version'],
    version: '2.4.5', versionText: 'deno 2.4.5\n', sha256: '0'.repeat(64),
  } }));
  await expect(verifyTool(root, 'deno')).resolves.toEqual({ status: 'unavailable', reason: 'not-provisioned' });
  const script = join(root, 'version.js');
  const otherScript = join(root, 'other-version.js');
  const source = "console.log('deno 2.4.5')\n";
  writeFileSync(script, source);
  writeFileSync(otherScript, source);
  const executable = realpathSync(process.execPath);
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify({ schema: 1, deno: {
    status: 'pinned', argv: ['/missing/runtime', script], versionArgv: ['/missing/runtime', script, '--version'],
    version: '2.4.5', versionText: 'deno 2.4.5\n', sha256: hash(source),
  } }));
  await expect(verifyTool(root, 'deno')).resolves.toEqual({ status: 'unavailable', reason: 'not-provisioned' });
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify({ schema: 1, deno: {
    status: 'pinned', argv: [executable, script], versionArgv: [executable, otherScript, '--version'],
    version: '2.4.5', versionText: 'deno 2.4.5\n', sha256: hash(source),
  } }));
  await expect(verifyTool(root, 'deno')).rejects.toThrow('version argv must extend invocation argv');
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify({ schema: 1, deno: {
    status: 'pinned', argv: ['deno'], versionArgv: ['deno', '--version'], version: '2.4.5',
  } }));
  await expect(verifyTool(root, 'deno')).rejects.toThrow('incomplete pinned identity');
  writeFileSync(join(root, 'tools/platform-versions.json'), JSON.stringify({ schema: 2, deno: {
    status: 'unavailable', reason: 'not-provisioned',
  } }));
  await expect(verifyTool(root, 'deno')).rejects.toThrow('schema 1');
});

const packageDocument = {
  exports: {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    './node': { types: './dist/node.d.ts', default: './dist/node.js' },
    './sas-box': { types: './dist/sas-box.d.ts', default: './dist/sas-box.js' },
    './val-box': { types: './dist/val-box.d.ts', default: './dist/val-box.js' },
  },
};
const packedFiles = [
  'package.json', 'README.md', 'LICENSE',
  'dist/index.d.ts', 'dist/index.js', 'dist/node.d.ts', 'dist/node.js',
  'dist/sas-box.d.ts', 'dist/sas-box.js', 'dist/val-box.d.ts', 'dist/val-box.js',
];

function archiveFixture() {
  const packageTree = temporaryRoot();
  writeFileSync(join(packageTree, 'package.json'), JSON.stringify(packageDocument));
  writeFileSync(join(packageTree, 'README.md'), 'readme');
  writeFileSync(join(packageTree, 'LICENSE'), 'license');
  const result = { filename: 'di-bag-0.1.0.tgz', files: packedFiles.map(path => ({ path })) };
  return { packageTree, result, stdout: `${JSON.stringify([result])}\n` };
}

test('pack output requires exactly one archive and empty stderr', () => {
  const fixture = archiveFixture();
  expect(validatePackOutput(fixture.packageTree, fixture.stdout)).toEqual(fixture.result);
  expect(() => validatePackOutput(fixture.packageTree, JSON.stringify([fixture.result, fixture.result])))
    .toThrow('exactly one archive');
  expect(() => validatePackOutput(fixture.packageTree, fixture.stdout, 'npm warning\n'))
    .toThrow('stderr is not empty');
  expect(() => validatePackOutput(fixture.packageTree, 'not JSON')).toThrow('not JSON');
  expect(() => validatePackOutput(fixture.packageTree, JSON.stringify([{}]))).toThrow('incomplete');
  expect(() => validatePackOutput(fixture.packageTree, JSON.stringify([{ ...fixture.result, filename: '../outside.tgz' }])))
    .toThrow('unsafe archive filename');
});

test('pack output rejects every missing declared export and package document', () => {
  for (const missing of packedFiles) {
    const fixture = archiveFixture();
    fixture.result.files = fixture.result.files.filter(file => file.path !== missing);
    expect(() => validatePackOutput(fixture.packageTree, JSON.stringify([fixture.result]))).toThrow(`missing ${missing}`);
  }
});

test('packed archive validation catches a missing archive, changed bytes and stale file inventory', () => {
  const fixture = archiveFixture();
  const archivePath = join(fixture.packageTree, fixture.result.filename);
  const archiveBytes = tarArchive(Object.fromEntries(packedFiles.map(path => [path,
    path === 'package.json' ? JSON.stringify(packageDocument) : `contents for ${path}`])));
  writeFileSync(archivePath, archiveBytes);
  const sha256 = createHash('sha256').update(archiveBytes).digest('hex');
  const archive = { path: archivePath, packageTree: fixture.packageTree, sha256, files: packedFiles };
  expect(() => validatePackedArchive(archive)).not.toThrow();
  expect(() => validatePackedArchive({ ...archive, sha256: '0'.repeat(64) })).toThrow('SHA-256 mismatch');
  writeFileSync(archivePath, 'mutated archive bytes');
  expect(() => validatePackedArchive(archive)).toThrow('SHA-256 mismatch');
  expect(() => validatePackedArchive({ ...archive, path: join(fixture.packageTree, 'missing.tgz') })).toThrow('does not exist');
  writeFileSync(archivePath, archiveBytes);
  expect(() => validatePackedArchive({ ...archive, files: packedFiles.filter(path => path !== 'dist/index.js') }))
    .toThrow('missing dist/index.js');
  writeFileSync(archivePath, 'not an archive');
  const fake = { ...archive, sha256: hash('not an archive') };
  expect(() => validatePackedArchive(fake)).toThrow('not a gzip tar archive');
  const missingActual = tarArchive(Object.fromEntries(packedFiles.filter(path => path !== 'dist/node.js')
    .map(path => [path, path === 'package.json' ? JSON.stringify(packageDocument) : `contents for ${path}`])));
  writeFileSync(archivePath, missingActual);
  expect(() => validatePackedArchive({ ...archive, sha256: createHash('sha256').update(missingActual).digest('hex') }))
    .toThrow('archive bytes are missing dist/node.js');
});

test('repository manifest verifies every provisioned identity and retains absent tools as unavailable', async () => {
  const root = resolve(__dirname, '..');
  const names: PlatformTool[] = ['node', 'npm', 'classic6', 'bun', 'deno', 'esbuild', 'playwright', 'chromium'];
  const results = await Promise.all(names.map(name => verifyTool(root, name)));
  expect(results.map(result => result.status)).toEqual([
    'pinned', 'pinned', 'pinned', 'pinned', 'unavailable', 'unavailable', 'unavailable', 'unavailable',
  ]);
  for (const result of results.slice(0, 4)) {
    expect(result).toMatchObject({ status: 'pinned' });
    expect(existsSync((result as { hashPath: string }).hashPath)).toBe(true);
  }
  for (const result of results.slice(4)) expect(result).toEqual({ status: 'unavailable', reason: 'not-provisioned' });
}, 20_000);

test('isolated classic pack contains only freshly built declared exports and rechecks its hash', async () => {
  const root = resolve(__dirname, '..');
  const [node, npm, classic6] = await Promise.all([
    verifyTool(root, 'node'), verifyTool(root, 'npm'), verifyTool(root, 'classic6'),
  ]);
  if (node.status !== 'pinned' || npm.status !== 'pinned' || classic6.status !== 'pinned') throw new Error('foundation tools unavailable');
  const archive = await packIsolatedClassic(root, node, npm, classic6);
  temporaryRoots.push(archive.packageTree);
  expect(archive.packageTree).toStartWith(join(tmpdir(), 'di-bag-platform-'));
  expect(readFileSync(join(archive.packageTree, 'src/index.ts'), 'utf8')).toBe(readFileSync(join(root, 'src/index.ts'), 'utf8'));
  expect(existsSync(join(archive.packageTree, 'dist/index.js'))).toBe(true);
  expect(existsSync(archive.path)).toBe(true);
  expect(archive.files).toEqual(expect.arrayContaining(packedFiles));
  expect(() => validatePackedArchive(archive)).not.toThrow();
});

test('evidence writer appends stable sorted JSONL under the source/date directory', async () => {
  const root = temporaryRoot();
  const row = {
    schema: 1 as const, lane: 'archive', status: 'pass' as const, utc: '2026-09-08T12:00:00.000Z',
    git: { sha: 'abcdef0123456789', dirty: true }, z: 2, a: 1,
  };
  const path = await writePlatformEvidence(root, row);
  expect(path).toBe(join(root, 'docs/benchmarks/results/2026-09-08-abcdef0/platform.jsonl'));
  expect(readFileSync(path, 'utf8')).toBe(`${stableJson(row)}\n`);
  await writePlatformEvidence(root, { ...row, lane: 'deno-root', status: 'unavailable', reason: 'not-provisioned' });
  expect(readFileSync(path, 'utf8').split('\n').filter(Boolean)).toHaveLength(2);
  expect(readFileSync(path, 'utf8').split('\n')[0]).toStartWith('{"a":1,"git"');
});
