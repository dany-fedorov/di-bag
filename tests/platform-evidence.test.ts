import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import {
  assertBrowserMetafile,
  evaluatePlatformChild,
  packIsolatedClassic,
  platformEvidenceExitCode,
  runPlatformEvidence,
  stableJson,
  validatePackOutput,
  validatePackedArchive,
  verifyTool,
  writePlatformEvidence,
  type PlatformEnvironment,
  type PlatformTool,
  type VerifiedTool,
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

type TestTarEntry = { path: string; contents: string; type?: '0' | 'x' };

function tarArchiveEntries(entries: readonly TestTarEntry[], trailing = new Uint8Array()): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (const { path, contents, type = '0' } of entries) {
    const body = Buffer.from(contents);
    const header = Buffer.alloc(512);
    header.write(`package/${path}`, 0, 100, 'utf8');
    header.write('0000644\0', 100, 8, 'ascii');
    header.write('0000000\0', 108, 8, 'ascii');
    header.write('0000000\0', 116, 8, 'ascii');
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
    header.write('00000000000\0', 136, 12, 'ascii');
    header.fill(0x20, 148, 156);
    header.write(type, 156, 1, 'ascii');
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    chunks.push(Uint8Array.from(header), Uint8Array.from(body));
    const padding = (512 - body.length % 512) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(1024));
  if (trailing.length) chunks.push(trailing);
  return Uint8Array.from(gzipSync(Uint8Array.from(Buffer.concat(chunks))));
}

function tarArchive(files: Readonly<Record<string, string>>): Uint8Array {
  return tarArchiveEntries(Object.entries(files).map(([path, contents]) => ({ path, contents })));
}

function paxPath(path: string): string {
  const body = ` path=${path}\n`;
  let length = body.length + 1;
  while (`${length}${body}`.length !== length) length = `${length}${body}`.length;
  return `${length}${body}`;
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
    stdout: '{"__proto__":{"hostile":true},"lane":"deno-root","result":{"ok":true}}\n' }))
    .toEqual({ status: 'fail', reason: 'child result mismatch' });
  expect(evaluatePlatformChild(expected, { ...cleanChild,
    stdout: '{"lane":"deno-root","result":{"__proto__":{"hostile":true},"ok":true}}\n' }))
    .toEqual({ status: 'fail', reason: 'child result mismatch' });
  expect(evaluatePlatformChild(expected, { ...cleanChild,
    stdout: '{"result":{"ok":true},"lane":"deno-root"}\n' }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
  const nestedExpected = { lane: 'deno-root', result: { a: true, z: true } };
  expect(evaluatePlatformChild(nestedExpected, { ...cleanChild,
    stdout: '{"lane":"deno-root","result":{"z":true,"a":true}}\n' }))
    .toEqual({ status: 'fail', reason: 'child stdout is not one canonical JSON object' });
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
  'dist/internal.js',
];

function archiveFixture() {
  const packageTree = temporaryRoot();
  writeFileSync(join(packageTree, 'package.json'), JSON.stringify(packageDocument));
  writeFileSync(join(packageTree, 'README.md'), 'readme');
  writeFileSync(join(packageTree, 'LICENSE'), 'license');
  mkdirSync(join(packageTree, 'dist'));
  for (const path of packedFiles.filter(path => path.startsWith('dist/'))) {
    writeFileSync(join(packageTree, path), `contents for ${path}`);
  }
  const result = { filename: 'di-bag-0.1.0.tgz', files: packedFiles.map(path => ({ path })) };
  return { packageTree, result, stdout: `${JSON.stringify([result])}\n` };
}

function packedContents(packageTree: string): Record<string, string> {
  return Object.fromEntries(packedFiles.map(path => [path, readFileSync(join(packageTree, path), 'utf8')]));
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
  for (const missing of packedFiles.filter(path => path !== 'dist/internal.js')) {
    const fixture = archiveFixture();
    fixture.result.files = fixture.result.files.filter(file => file.path !== missing);
    expect(() => validatePackOutput(fixture.packageTree, JSON.stringify([fixture.result]))).toThrow(`missing ${missing}`);
  }
});

test('packed archive validation catches a missing archive, changed bytes and stale file inventory', () => {
  const fixture = archiveFixture();
  const archivePath = join(fixture.packageTree, fixture.result.filename);
  const contents = packedContents(fixture.packageTree);
  const archiveBytes = tarArchive(contents);
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
  const missingActual = tarArchive(Object.fromEntries(Object.entries(contents).filter(([path]) => path !== 'dist/node.js')));
  writeFileSync(archivePath, missingActual);
  expect(() => validatePackedArchive({ ...archive, sha256: createHash('sha256').update(missingActual).digest('hex') }))
    .toThrow('archive bytes are missing dist/node.js');
  const paxOverride = tarArchiveEntries([
    ...Object.entries(contents).filter(([path]) => path !== 'dist/index.js').map(([path, entryContents]) => ({
      path, contents: entryContents,
    })),
    { path: 'PaxHeader/index.js', type: 'x', contents: paxPath('package/dist/not-index.js') },
    { path: 'dist/index.js', contents: 'misleading raw header' },
  ]);
  writeFileSync(archivePath, paxOverride);
  expect(() => validatePackedArchive({ ...archive, sha256: createHash('sha256').update(paxOverride).digest('hex') }))
    .toThrow('unsupported tar entry type');
});

test('archive inventory is an exact allowlist and package documents match isolated inputs byte-for-byte', () => {
  const fixture = archiveFixture();
  const archivePath = join(fixture.packageTree, fixture.result.filename);
  const contents = packedContents(fixture.packageTree);
  const writeArchive = (entries: Record<string, string>, files = Object.keys(entries), trailing?: Uint8Array) => {
    const bytes = trailing
      ? tarArchiveEntries(Object.entries(entries).map(([path, entryContents]) => ({ path, contents: entryContents })), Uint8Array.from(trailing))
      : tarArchive(entries);
    writeFileSync(archivePath, bytes);
    return { path: archivePath, packageTree: fixture.packageTree,
      sha256: createHash('sha256').update(bytes).digest('hex'), files };
  };

  expect(() => validatePackedArchive(writeArchive(contents))).not.toThrow();
  expect(() => validatePackedArchive(writeArchive(contents, packedFiles.filter(path => path !== 'dist/internal.js'))))
    .toThrow('claimed inventory is missing dist/internal.js');
  const withoutInternal = Object.fromEntries(Object.entries(contents).filter(([path]) => path !== 'dist/internal.js'));
  expect(() => validatePackedArchive(writeArchive(withoutInternal, packedFiles)))
    .toThrow('archive bytes are missing dist/internal.js');

  for (const unexpected of ['src/index.ts', 'tests/secret.ts', '.npmrc', '.env']) {
    expect(() => validatePackedArchive(writeArchive({ ...contents, [unexpected]: 'secret' }, [...packedFiles, unexpected])))
      .toThrow(`unexpected file ${unexpected}`);
  }
  for (const document of ['package.json', 'README.md', 'LICENSE']) {
    const changed = document === 'package.json' ? JSON.stringify({ ...packageDocument, name: 'wrong-package' }) : `${contents[document]} mutated`;
    expect(() => validatePackedArchive(writeArchive({ ...contents, [document]: changed })))
      .toThrow(`content mismatch for ${document}`);
  }
  expect(() => validatePackedArchive(writeArchive({ ...contents, 'package.json': '{broken' })))
    .toThrow('invalid package.json');
  expect(() => validatePackedArchive(writeArchive(contents, packedFiles, Uint8Array.of(1))))
    .toThrow('nonzero data after tar terminator');
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
  expect(archive.files).toEqual(expect.arrayContaining(packedFiles.filter(path => path !== 'dist/internal.js')));
  expect(() => validatePackedArchive(archive)).not.toThrow();

  const wrongNode = { ...node, argv: [realpathSync('/bin/false')] } as VerifiedTool;
  await expect(packIsolatedClassic(root, wrongNode, npm, classic6)).rejects.toThrow('must share exact runtime');
});

test('evidence writer appends stable sorted JSONL under the source/date directory', async () => {
  const root = temporaryRoot();
  const row = {
    schema: 1 as const, lane: 'archive', status: 'pass' as const, utc: '2026-09-08T12:00:00.000Z',
    git: { sha: 'abcdef0123456789abcdef0123456789abcdef01', dirty: true }, z: 2, a: 1,
  };
  const path = await writePlatformEvidence(root, row);
  expect(path).toBe(join(root, 'docs/benchmarks/results/2026-09-08-abcdef0/platform.jsonl'));
  expect(readFileSync(path, 'utf8')).toBe(`${stableJson(row)}\n`);
  await writePlatformEvidence(root, { ...row, lane: 'deno-root', status: 'unavailable', reason: 'not-provisioned' });
  expect(readFileSync(path, 'utf8').split('\n').filter(Boolean)).toHaveLength(2);
  expect(readFileSync(path, 'utf8').split('\n')[0]).toStartWith('{"a":1,"git"');
  for (const git of [{ sha: 'abcdef0', dirty: false }, { sha: 'A'.repeat(40), dirty: false }]) {
    await expect(writePlatformEvidence(root, { ...row, git })).rejects.toThrow('40-character Git SHA');
  }
  for (const utc of ['2026-02-30T12:00:00.000Z', '2026-09-08T12:00:00+00:00', '2026-09-08']) {
    await expect(writePlatformEvidence(root, { ...row, utc })).rejects.toThrow('canonical UTC ISO timestamp');
  }
});

test('platform command writes one sorted matrix with an executed archive and explicit unavailable lanes', async () => {
  const root = resolve(__dirname, '..');
  const outputRoot = temporaryRoot();
  const result = await runPlatformEvidence(root, outputRoot);
  const expectedJsonl = `${result.rows.map(row => stableJson(row)).join('\n')}\n`;
  const jsonl = readFileSync(result.jsonlPath, 'utf8');

  expect(jsonl).toBe(expectedJsonl);
  expect(jsonl.split('\n').filter(Boolean)).toHaveLength(3);

  expect(result.rows.map(row => ({ lane: row.lane, status: row.status }))).toEqual([
    { lane: 'archive', status: 'pass' },
    { lane: 'deno-root', status: 'unavailable' },
    { lane: 'browser-worker-minified', status: 'unavailable' },
  ]);
  expect((result.rows[0].archive as { files: readonly string[] }).files).toEqual(expect.arrayContaining([
    'dist/index.js', 'dist/node.js', 'dist/sas-box.js', 'dist/val-box.js',
  ]));
  expect(result.rows[0]).toMatchObject({
    tools: {
      classic6: { status: 'pinned', version: '6.0.3' },
      node: { status: 'pinned', version: '24.20.0' },
      npm: { status: 'pinned', version: '11.19.0' },
    },
  });
  expect(result.rows[1]).toMatchObject({
    reason: 'not-provisioned',
    tools: { deno: { status: 'unavailable', reason: 'not-provisioned' } },
  });
  expect(result.rows[2]).toMatchObject({
    reason: 'esbuild-not-provisioned',
    tools: {
      chromium: { status: 'unavailable', reason: 'not-provisioned' },
      esbuild: { status: 'unavailable', reason: 'not-provisioned' },
      playwright: { status: 'unavailable', reason: 'not-provisioned' },
    },
  });

  const summary = readFileSync(result.summaryPath, 'utf8');
  expect(summary).toContain('| archive | pass |');
  expect(summary).toContain('| deno-root | unavailable |');
  expect(summary).toContain('| browser-worker-minified | unavailable |');
  expect(summary).toContain('Historical Node/Bun archive results are not reclassified as current runtime evidence.');
}, 60_000);

test('platform evidence module imports under the pinned Node ESM loader', async () => {
  const root = resolve(__dirname, '..');
  const node = await verifyTool(root, 'node');
  if (node.status !== 'pinned') throw new Error('pinned Node unavailable');
  const imported = spawnSync(node.argv[0], [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--input-type=module',
    '--eval',
    `import(${JSON.stringify(pathToFileURL(join(root, 'scripts/platform-evidence.ts')).href)})`,
  ], { cwd: root, encoding: 'utf8' });
  expect({ status: imported.status, signal: imported.signal, stdout: imported.stdout, stderr: imported.stderr })
    .toEqual({ status: 0, signal: null, stdout: '', stderr: '' });
});

test('platform command retains archive failure rows and makes required failures nonzero', async () => {
  const root = resolve(__dirname, '..');
  const brokenRoot = temporaryRoot();
  cpSync(join(root, 'tools/platform-versions.json'), join(brokenRoot, 'tools/platform-versions.json'));
  for (const name of ['src', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'LICENSE']) {
    cpSync(join(root, name), join(brokenRoot, name), { recursive: true });
  }

  const result = await runPlatformEvidence(brokenRoot, brokenRoot);
  expect(result.rows.map(row => ({ lane: row.lane, status: row.status, reason: row.reason }))).toEqual([
    { lane: 'archive', status: 'fail', reason: 'isolated package source is missing tsconfig.build.json' },
    { lane: 'deno-root', status: 'unavailable', reason: 'archive-failed' },
    { lane: 'browser-worker-minified', status: 'unavailable', reason: 'archive-failed' },
  ]);
  expect(platformEvidenceExitCode(result.rows)).toBe(1);
  expect(readFileSync(result.jsonlPath, 'utf8')).toBe(`${result.rows.map(row => stableJson(row)).join('\n')}\n`);
  const { reason: _archiveReason, ...archivePass } = result.rows[0];
  expect(platformEvidenceExitCode([
    { ...archivePass, status: 'pass' },
    { ...result.rows[1], status: 'unavailable' },
    { ...result.rows[2], status: 'unavailable' },
  ])).toBe(0);
}, 30_000);

test('browser metafile parser rejects malformed shapes before resolving inputs', () => {
  const root = temporaryRoot();
  for (const malformed of [null, [], {}, { inputs: null }, { inputs: [] }, { inputs: {}, outputs: null }]) {
    expect(() => assertBrowserMetafile(malformed, root)).toThrow('invalid esbuild metafile');
  }
});
