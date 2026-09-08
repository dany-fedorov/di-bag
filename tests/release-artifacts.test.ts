import { afterAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { inspectNpmArchive } from '../scripts/release-archive.ts';
import { createPublicReleaseEvidence, createReleaseManifest, parseManifestArgs, serializeStable, type ReleaseEvidenceInput } from '../scripts/create-release-manifest.ts';
import { assertSafeReleaseArgv, parseReleaseCommandArgs, runReleaseCommand, type ReleaseCommandEvidence } from '../scripts/run-release-command.ts';
import { collectFreshNativeGaps, collectReviewedNativeGaps, createNativeInventory, parseNativeInventoryArgs } from '../scripts/release-native-inventory.ts';
import { APPROVED_HANDOFF_PATHS, createReleaseAudit, parseReleaseAuditArgs } from '../scripts/create-release-audit.ts';
import { hashReleaseTree, parseReleaseTreeArgs } from '../scripts/hash-release-tree.ts';
import { nativeDiagnosticGapMessages } from './native-diagnostic-markers.ts';

const root = resolve(__dirname, '..');
const packageManifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  exports: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  bundledDependencies?: readonly string[];
};

const packageNames = ['sas-box', 'val-box', 'di-bag'] as const;
const authorizationHeading = '## DO NOT RUN without fresh explicit authorization';

function onlineCommands(version: string): readonly string[] {
  return [
    ...packageNames.map(name =>
      `npm view ${name}@${version} version --registry=https://registry.npmjs.org`),
    'npm login --registry=https://registry.npmjs.org',
    `npm publish /tmp/di-bag-release-candidate/sas-box-${version}.tgz --access public --provenance`,
    `npm dist-tag add sas-box@${version} latest --registry=https://registry.npmjs.org`,
    `npm publish /tmp/di-bag-release-candidate/val-box-${version}.tgz --access public --provenance`,
    `npm dist-tag add val-box@${version} latest --registry=https://registry.npmjs.org`,
    `npm publish /tmp/di-bag-release-candidate/di-bag-${version}.tgz --access public --provenance`,
    `npm dist-tag add di-bag@${version} latest --registry=https://registry.npmjs.org`,
  ];
}

function validatePublishingDocument(document: string, version: string): string[] {
  const failures: string[] = [];
  const headingIndex = document.indexOf(authorizationHeading);
  if (headingIndex < 0) failures.push('missing authorization heading');
  if (headingIndex >= 0 && document.indexOf(authorizationHeading, headingIndex + 1) >= 0)
    failures.push('authorization heading must occur exactly once');
  const beforeAppendix = headingIndex < 0 ? document : document.slice(0, headingIndex);
  const appendix = headingIndex < 0 ? '' : document.slice(headingIndex);
  for (const token of [
    'npm view', 'npm whoami', 'npm login', 'npm publish', 'npm dist-tag',
    'npm token', 'npm config', 'npm audit', 'git tag', 'git push',
    '--provenance', '.npmrc', '_authToken',
  ]) if (beforeAppendix.includes(token)) failures.push(`online token precedes authorization heading: ${token}`);
  for (const command of onlineCommands(version)) {
    const count = document.split(command).length - 1;
    if (count !== 1) failures.push(`expected command exactly once: ${command}`);
    if (beforeAppendix.includes(command)) failures.push(`online command precedes authorization heading: ${command}`);
    if (!appendix.includes(command)) failures.push(`online command missing from appendix: ${command}`);
  }
  for (const required of [
    '/tmp/di-bag-release-candidate',
    '.related-repos/sas-box',
    '.related-repos/val-box',
    'npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock',
    'Registry version/owner/access/tag/provenance status is unavailable',
    'npm versions are immutable',
  ]) if (!beforeAppendix.includes(required)) failures.push(`missing local workflow fact: ${required}`);
  return failures;
}

function appendixCommands(document: string): readonly string[] {
  const appendix = document.slice(document.indexOf(authorizationHeading));
  const matches = appendix.match(/```bash\n([\s\S]*?)\n```\s*$/);
  return matches?.[1]?.split('\n') ?? [];
}

describe('release documentation contract', () => {
  test('release documents match the frozen package and gate every online command', () => {
    const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
    const publishing = readFileSync(resolve(root, 'PUBLISHING.md'), 'utf8');
    expect(packageManifest).toMatchObject({ name: 'di-bag', version: '0.1.0' });
    expect(changelog.match(new RegExp(`^## ${packageManifest.version}$`, 'gm'))).toHaveLength(1);
    expect(changelog).not.toContain('## Unreleased');
    expect(validatePublishingDocument(publishing, packageManifest.version)).toEqual([]);
    expect(appendixCommands(publishing)).toEqual(onlineCommands(packageManifest.version));
  });

  test('the publication boundary rejects stale, missing, duplicated, and misplaced commands', () => {
    const publishing = readFileSync(resolve(root, 'PUBLISHING.md'), 'utf8');
    const command = onlineCommands(packageManifest.version)[0]!;
    expect(validatePublishingDocument(publishing.replaceAll(packageManifest.version, '9.9.9'), packageManifest.version))
      .toContain(`expected command exactly once: ${command}`);
    expect(validatePublishingDocument(publishing.replace(command, ''), packageManifest.version))
      .toContain(`expected command exactly once: ${command}`);
    expect(validatePublishingDocument(`${command}\n${publishing}`, packageManifest.version))
      .toContain(`online command precedes authorization heading: ${command}`);
    expect(validatePublishingDocument(`${publishing}\n${command}`, packageManifest.version))
      .toContain(`expected command exactly once: ${command}`);
    expect(validatePublishingDocument(publishing.replace(authorizationHeading, ''), packageManifest.version))
      .toContain('missing authorization heading');
    expect(validatePublishingDocument(publishing.replace(authorizationHeading, `${authorizationHeading}\n${authorizationHeading}`), packageManifest.version))
      .toContain('authorization heading must occur exactly once');
    expect(validatePublishingDocument(publishing.replaceAll('/tmp/di-bag-release-candidate', '/tmp/other'), packageManifest.version))
      .toContain('missing local workflow fact: /tmp/di-bag-release-candidate');
    for (const [prohibited, token] of [
      ['npm whoami --registry=https://registry.npmjs.org', 'npm whoami'],
      ['npm token list', 'npm token'],
      ['npm config set //registry.npmjs.org/:_authToken secret', 'npm config'],
      ['git tag v0.1.0', 'git tag'],
      ['git push origin feat/v0.1', 'git push'],
      ['npm audit signatures --provenance', 'npm audit'],
      ['printf secret > ~/.npmrc', '.npmrc'],
    ]) {
      expect(validatePublishingDocument(`${prohibited}\n${publishing}`, packageManifest.version))
        .toContain(`online token precedes authorization heading: ${token}`);
    }
  });

  test('public docs state entry-point, adapter, acquisition, ownership, and release limits', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    const migration = readFileSync(resolve(root, 'docs/migrations/0.1-to-enterprise.md'), 'utf8');
    const tracker = readFileSync(resolve(root, 'docs/superpowers/plans/2026-09-06-enterprise-di-program.md'), 'utf8');

    expect(readme).not.toContain('The package publishes');
    expect(packageManifest.exports).toEqual({
      './node': { types: './dist/node.d.ts', default: './dist/node.js' },
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      './sas-box': { types: './dist/sas-box.d.ts', default: './dist/sas-box.js' },
      './val-box': { types: './dist/val-box.d.ts', default: './dist/val-box.js' },
    });
    expect(packageManifest.dependencies ?? {}).toEqual({});
    expect(packageManifest.peerDependencies ?? {}).toEqual({});
    expect(packageManifest.optionalDependencies ?? {}).toEqual({});
    expect(packageManifest.bundledDependencies ?? []).toEqual([]);
    for (const text of [readme, migration]) {
      for (const entry of ['di-bag', 'di-bag/node', 'di-bag/sas-box', 'di-bag/val-box'])
        expect(text).toContain(`\`${entry}\``);
      for (const fact of ['structural adapters', 'raw', 'native', 'selected scopes', 'non-blocking observers', 'original acquired value'])
        expect(text).toContain(fact);
    }
    expect(readme).toContain('npm run check');
    expect(readme).toContain('npm run check:native');
    expect(migration).toContain('application-owned plugin loading');
    expect(tracker).toContain('Local release-candidate handoff');
    expect(tracker).toContain('registry version and publication remain unavailable');
  });
});

describe('release artifact scripts', () => {
  test('reject unsafe and unsupported manifest arguments', () => {
    expect(() => parseManifestArgs(['--input', 'relative', '--out', '/tmp/candidate.json']))
      .toThrow('evidence input must be absolute');
    expect(() => parseManifestArgs(['--input', '/tmp/input.json', '--out', '/tmp/candidate.json', '--package', 'x']))
      .toThrow('unsupported option: --package');
  });

  test('expose guarded parsers and archive inspection', () => {
    expect(typeof inspectNpmArchive).toBe('function');
    expect(typeof parseReleaseCommandArgs).toBe('function');
    expect(typeof parseNativeInventoryArgs).toBe('function');
    expect(typeof parseReleaseAuditArgs).toBe('function');
    expect(typeof parseReleaseTreeArgs).toBe('function');
  });
});

const scratch = mkdtempSync(join(tmpdir(), 'di-bag-release-tests-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function tarField(header: Uint8Array, offset: number, length: number, value: string): void {
  header.set(Buffer.from(value), offset); header[Math.min(offset + value.length, offset + length - 1)] = 0;
}
function archiveOf(entries: readonly Readonly<{ path: string; content: string; type?: number; declaredSize?: number }>[], options: Readonly<{ badChecksum?: boolean; badMagic?: boolean; nonzeroPadding?: boolean; terminators?: number; trailing?: string }> = {}): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    const header = new Uint8Array(512); tarField(header, 0, 100, entry.path); tarField(header, 100, 8, '0000644'); tarField(header, 108, 8, '0000000'); tarField(header, 116, 8, '0000000');
    const content = new TextEncoder().encode(entry.content), size = entry.declaredSize ?? content.length;
    tarField(header, 124, 12, size.toString(8).padStart(11, '0')); tarField(header, 136, 12, '00000000000'); header.fill(32, 148, 156); header[156] = entry.type ?? 48; tarField(header, 257, 6, options.badMagic ? 'bad!!' : 'ustar'); header.set(new TextEncoder().encode('00'), 263);
    let sum = 0; for (const byte of header) sum += byte; tarField(header, 148, 8, (sum + (options.badChecksum ? 1 : 0)).toString(8).padStart(6, '0'));
    const padding = new Uint8Array((512 - content.length % 512) % 512); if (options.nonzeroPadding && padding.length) padding[0] = 1;
    parts.push(header, content, padding);
  }
  for (let index = 0; index < (options.terminators ?? 2); index++) parts.push(new Uint8Array(512));
  if (options.trailing) parts.push(new TextEncoder().encode(options.trailing));
  const length = parts.reduce((sum, part) => sum + part.length, 0), tar = new Uint8Array(length); let offset = 0;
  for (const part of parts) { tar.set(part, offset); offset += part.length; }
  return new Uint8Array(gzipSync(tar));
}
const minimalPackage = (name = 'di-bag') => JSON.stringify({ name, version: '0.1.0', main: './dist/index.js', types: './dist/index.d.ts', files: ['dist'], exports: { '.': './dist/index.js' } });

describe('safe npm archive parser', () => {
  test('returns sorted regular entries and exact package metadata bytes', () => {
    const bytes = archiveOf([{ path: 'package/z.txt', content: 'z' }, { path: 'package/package.json', content: minimalPackage() }, { path: 'package/a.txt', content: 'abc' }]);
    const result = inspectNpmArchive(bytes);
    expect(result.entries.map(entry => entry.path)).toEqual(['package/a.txt', 'package/package.json', 'package/z.txt']);
    expect(new TextDecoder().decode(result.packageJson)).toBe(minimalPackage());
    expect(result.unpackedBytes).toBe(1 + 3 + Buffer.byteLength(minimalPackage()));
    expect(result.entries[0]).toMatchObject({ bytes: 3, mode: 420, sha256: createHash('sha256').update('abc').digest('hex') });
  });

  for (const [name, make, message] of [
    ['absolute name', () => archiveOf([{ path: '/package/package.json', content: minimalPackage() }]), 'unsafe archive path'],
    ['traversal', () => archiveOf([{ path: 'package/../x', content: 'x' }, { path: 'package/package.json', content: minimalPackage() }]), 'unsafe archive path'],
    ['backslash', () => archiveOf([{ path: 'package\\package.json', content: minimalPackage() }]), 'unsafe archive path'],
    ['outside package', () => archiveOf([{ path: 'other/package.json', content: minimalPackage() }]), 'outside package'],
    ['duplicate', () => archiveOf([{ path: 'package/package.json', content: minimalPackage() }, { path: 'package/package.json', content: minimalPackage() }]), 'duplicate'],
    ['prefix collision', () => archiveOf([{ path: 'package/a', content: 'x' }, { path: 'package/a/b', content: 'y' }, { path: 'package/package.json', content: minimalPackage() }]), 'prefix collision'],
    ['symlink', () => archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 50 }]), 'unsupported archive entry type'],
    ['hardlink', () => archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 49 }]), 'unsupported archive entry type'],
    ['fifo', () => archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 54 }]), 'unsupported archive entry type'],
    ['device', () => archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 51 }]), 'unsupported archive entry type'],
    ['unknown type', () => archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 88 }]), 'unsupported archive entry type'],
    ['NUL ambiguity', () => archiveOf([{ path: 'package/a\0x', content: 'a' }, { path: 'package/package.json', content: minimalPackage() }]), 'ambiguous NUL'],
    ['entry size ceiling', () => archiveOf([{ path: 'package/package.json', content: minimalPackage(), declaredSize: 129 * 1024 * 1024 }]), 'size limit'],
    ['checksum', () => archiveOf([{ path: 'package/package.json', content: minimalPackage() }], { badChecksum: true }), 'checksum mismatch'],
    ['magic', () => archiveOf([{ path: 'package/package.json', content: minimalPackage() }], { badMagic: true }), 'ustar magic'],
    ['nonzero padding', () => archiveOf([{ path: 'package/package.json', content: minimalPackage() }], { nonzeroPadding: true }), 'nonzero padding'],
    ['terminator', () => archiveOf([{ path: 'package/package.json', content: minimalPackage() }], { terminators: 1 }), 'terminator'],
    ['trailing junk', () => archiveOf([{ path: 'package/package.json', content: minimalPackage() }], { trailing: 'junk' }), 'trailing junk'],
    ['truncated entry', () => archiveOf([{ path: 'package/package.json', content: minimalPackage(), declaredSize: 1024 }]), 'truncated'],
    ['missing metadata', () => archiveOf([{ path: 'package/a', content: 'a' }]), 'missing package/package.json'],
  ] as const) test(`rejects ${name}`, () => expect(() => inspectNpmArchive(make())).toThrow(message));
  test('rejects invalid and empty gzip bytes', () => {
    expect(() => inspectNpmArchive(new Uint8Array())).toThrow('empty');
    expect(() => inspectNpmArchive(new TextEncoder().encode('not gzip'))).toThrow('invalid gzip');
    const truncated = archiveOf([{ path: 'package/package.json', content: minimalPackage() }]).slice(0, 20);
    expect(() => inspectNpmArchive(truncated)).toThrow('invalid gzip');
  });
});

describe('command evidence runner', () => {
  const artifact = resolve(scratch, 'runner-artifacts'), cwd = resolve(scratch, 'cwd');
  mkdirSync(artifact); mkdirSync(cwd);
  test('parses canonical sorted inputs and preserves argv spaces', () => {
    const a = resolve(scratch, 'a'), b = resolve(scratch, 'b'); writeFileSync(a, 'a'); writeFileSync(b, 'bb');
    const parsed = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', resolve(artifact, 'r.json'), '--cwd', cwd, '--input', b, '--input', a, '--', process.execPath, '-e', 'console.log("a b")']);
    expect(parsed.inputs).toEqual([a, b]); expect(parsed.argv.at(-1)).toBe('console.log("a b")');
    expect(() => parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', resolve(artifact, 'r2.json'), '--cwd', cwd, '--input', a, '--input', a, '--', 'node', '-v'])).toThrow('duplicate input');
  });
  for (const argv of [
    ['bash', '-c', 'echo hi'], ['npm', 'view', 'di-bag'], ['npm', 'login'], ['npm', 'publish', 'a.tgz'], ['npm', 'dist-tag', 'add'], ['git', 'push'], ['git', 'tag', 'v1'],
    ['node', '--registry', 'x'], ['node', 'https://registry.npmjs.org'], ['node', '&&'], ['node -e thing'],
  ]) test(`rejects unsafe argv: ${argv.join(' ')}`, () => expect(() => assertSafeReleaseArgv(argv)).toThrow());
  test('rejects relative, escaping, symlinked, duplicate, and unsupported arguments', () => {
    expect(() => parseReleaseCommandArgs(['--artifact-dir', 'relative', '--record', resolve(artifact, 'x'), '--cwd', cwd, '--', 'node', '-v'])).toThrow('absolute canonical');
    expect(() => parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', resolve(scratch, 'escape'), '--cwd', cwd, '--', 'node', '-v'])).toThrow('contained');
    expect(() => parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', resolve(artifact, 'x'), '--cwd', cwd, '--wat', 'x', '--', 'node', '-v'])).toThrow('unsupported');
    expect(() => parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', resolve(artifact, 'x'), '--cwd', cwd, '--'])).toThrow('executable');
  });
  test('records stdout, stderr, input hashes, normalized success and record-last evidence', async () => {
    const input = resolve(scratch, 'runner-input'); writeFileSync(input, 'before');
    const args = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', resolve(artifact, 'success.json'), '--cwd', cwd, '--input', input, '--', process.execPath, '-e', 'console.log("hello space");console.error("kept")']);
    const record = await runReleaseCommand(args, { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 });
    expect(record).toMatchObject({ exitCode: 0, signal: null, terminationReason: null });
    expect(readFileSync(record.stdout.path, 'utf8')).toBe('hello space\n'); expect(readFileSync(record.stderr.path, 'utf8')).toBe('kept\n');
    expect(record.inputs[0]).toMatchObject({ bytes: 6, sha256: createHash('sha256').update('before').digest('hex') });
    expect(JSON.parse(readFileSync(args.record, 'utf8'))).toEqual(record);
  });
  test('rejects timeout, output overflow, nonzero status, and spawn failure without publishing a record', async () => {
    const cases: Array<[string, readonly string[], Parameters<typeof runReleaseCommand>[1], string]> = [
      ['timeout', [process.execPath, '-e', 'setTimeout(()=>{},1000)'], { timeoutMilliseconds: 20, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 }, 'timeout'],
      ['output', [process.execPath, '-e', 'console.log("x".repeat(10000))'], { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 32, sampleMilliseconds: 5 }, 'output'],
      ['nonzero', [process.execPath, '-e', 'process.exit(7)'], { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 }, 'exit 7'],
      ['spawn', [resolve(scratch, 'absent-executable')], { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 }, 'spawn'],
    ];
    for (const [name, argv, limits, message] of cases) {
      const record = resolve(artifact, `${name}.json`); const args = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', record, '--cwd', cwd, '--', ...argv]);
      await expect(runReleaseCommand(args, limits)).rejects.toThrow(message); expect(Bun.file(record).size).toBe(0);
    }
  });
  test('rejects injected memory, monitor, signal and spawn outcomes', async () => {
    const limits = { timeoutMilliseconds: 1, maxRssMiB: 1, maxOutputBytes: 1, sampleMilliseconds: 1 };
    for (const [name, result, message] of [
      ['memory', { status: null, signal: 'SIGKILL', terminationReason: 'memory' }, 'memory'],
      ['monitor', { status: null, signal: 'SIGKILL', terminationReason: 'monitor', error: 'rss unavailable' }, 'monitor'],
      ['signal', { status: null, signal: 'SIGTERM' }, 'SIGTERM'],
      ['spawn-injected', { status: null, signal: null, terminationReason: 'spawn', error: 'ENOENT' }, 'spawn'],
    ] as const) {
      const record = resolve(artifact, `${name}.json`), args = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', record, '--cwd', cwd, '--', 'node', '-v']);
      const supervisor: any = async () => ({ stdout: '', stderr: '', milliseconds: 1, peakObservedRssMiB: 2, ...result });
      await expect(runReleaseCommand(args, limits, supervisor)).rejects.toThrow(message); expect(Bun.file(record).size).toBe(0);
    }
  });
  test('hashes inputs before execution and rolls back orphan logs if record publication fails', async () => {
    const input = resolve(scratch, 'mutated-input'); writeFileSync(input, 'before');
    const record = resolve(artifact, 'mutator.json'), args = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', record, '--cwd', cwd, '--input', input, '--', process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(input)},'after')`]);
    const evidence = await runReleaseCommand(args, { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 });
    expect(evidence.inputs[0]?.sha256).toBe(createHash('sha256').update('before').digest('hex')); expect(readFileSync(input, 'utf8')).toBe('after');
    const badRecord = resolve(artifact, 'record-directory'); mkdirSync(badRecord);
    const badArgs = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', badRecord, '--cwd', cwd, '--', process.execPath, '-e', 'console.log("orphan")']);
    await expect(runReleaseCommand(badArgs, { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 })).rejects.toThrow();
    expect(Bun.file(`${badRecord}.stdout`).size).toBe(0); expect(Bun.file(`${badRecord}.stderr`).size).toBe(0);
    const logFailureRecord = resolve(artifact, 'log-failure.json'); mkdirSync(`${logFailureRecord}.stdout`);
    const logFailureArgs = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', logFailureRecord, '--cwd', cwd, '--', process.execPath, '-e', 'console.log("cannot publish")']);
    await expect(runReleaseCommand(logFailureArgs, { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 })).rejects.toThrow();
    expect(Bun.file(logFailureRecord).size).toBe(0); expect(Bun.file(`${logFailureRecord}.stderr`).size).toBe(0);
  });
});

describe('native gap inventory', () => {
  const reviewedRoot = resolve(root, 'tests/types');
  test('freezes exactly 27 recomputed stable reviewed occurrences', () => {
    expect(Object.isFrozen(nativeDiagnosticGapMessages)).toBe(true);
    const gaps = collectReviewedNativeGaps(reviewedRoot); expect(gaps).toHaveLength(27); expect(Object.isFrozen(gaps)).toBe(true);
    expect(new Set(gaps.map(gap => `${gap.fixture}:${gap.markerLine}:${gap.markerOccurrence}`)).size).toBe(27);
    for (const gap of gaps) expect(gap.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
  test('accepts empty and strict-subset fresh inventory and rejects changed or moved facts', () => {
    const reviewed = collectReviewedNativeGaps(reviewedRoot), first = reviewed[0]!;
    expect(collectFreshNativeGaps('', reviewed)).toEqual([]);
    const row = JSON.stringify({ fixture: first.fixture, gaps: [{ id: first.id, primary: { line: first.markerLine - 1 }, diagnostic: { code: 2769, message: first.normalizedMessage } }] });
    expect(collectFreshNativeGaps(row, reviewed)).toEqual([first]);
    expect(() => collectFreshNativeGaps(row.replace('2769', '1234'), reviewed)).toThrow('malformed');
    expect(() => collectFreshNativeGaps(row.replace(`"line":${first.markerLine - 1}`, '"line":99999'), reviewed)).toThrow('moved');
    const changed = JSON.stringify({ fixture: first.fixture, gaps: [{ id: first.id, primary: { line: first.markerLine - 1 }, diagnostic: { code: 2769, message: `${first.normalizedMessage} changed` } }] });
    expect(() => collectFreshNativeGaps(changed, reviewed)).toThrow('changed');
    expect(() => collectFreshNativeGaps(`${row}\n${row}`, reviewed)).toThrow(/duplicate|subset|changed/);
    expect(collectFreshNativeGaps(`\n> di-bag@0.1.0 check:native\n> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-native-contracts.ts\n${row}`, reviewed)).toEqual([first]);
    expect(() => collectFreshNativeGaps('> unexpected command\n', reviewed)).toThrow('invalid JSONL');
  });
  test('parses the documented relative reviewed root and exact absolute outputs', () => {
    const fresh = resolve(scratch, 'fresh.jsonl'), out = resolve(scratch, 'native.json'); writeFileSync(fresh, '');
    const parsed = parseNativeInventoryArgs(['--reviewed-root', 'tests/types', '--fresh-jsonl', fresh, '--out', out]);
    expect(parsed.reviewedRoot).toBe(reviewedRoot); expect(createNativeInventory(parsed.reviewedRoot, '')).toMatchObject({ freshGaps: [] });
    expect(() => parseNativeInventoryArgs(['--reviewed-root', 'tests/types', '--fresh-jsonl', 'relative', '--out', out])).toThrow('absolute canonical');
  });
});

describe('release tree hashing', () => {
  const artifact = resolve(scratch, 'tree-artifact'), tree = resolve(scratch, 'dist'); mkdirSync(artifact); mkdirSync(tree); mkdirSync(resolve(tree, 'nested')); writeFileSync(resolve(tree, 'z'), 'zz'); writeFileSync(resolve(tree, 'nested/a'), 'a');
  test('hashes sorted regular paths deterministically', () => {
    const first = hashReleaseTree(tree), second = hashReleaseTree(tree); expect(first).toEqual(second); expect(first.files.map(file => file.path)).toEqual(['nested/a', 'z']); expect(first.files.map(file => file.bytes)).toEqual([1, 2]);
  });
  test('rejects empty, symlink, special and unsafe argument layouts', () => {
    const empty = resolve(scratch, 'empty-tree'); mkdirSync(empty); expect(() => hashReleaseTree(empty)).toThrow('empty');
    const linked = resolve(scratch, 'linked-tree'); mkdirSync(linked); symlinkSync(resolve(tree, 'z'), resolve(linked, 'link')); expect(() => hashReleaseTree(linked)).toThrow('symlink');
    const special = resolve(scratch, 'special-tree'); mkdirSync(special); expect(spawnSync('mkfifo', [resolve(special, 'pipe')]).status).toBe(0); expect(() => hashReleaseTree(special)).toThrow('special');
    const artifactTree = resolve(artifact, 'dist'); mkdirSync(artifactTree); writeFileSync(resolve(artifactTree, 'a'), 'a');
    expect(() => parseReleaseTreeArgs(['--artifact-dir', artifact, '--root', artifactTree, '--out', resolve(artifactTree, 'digest.json')])).toThrow('alias');
    expect(() => parseReleaseTreeArgs(['--artifact-dir', artifact, '--root', tree, '--out', resolve(scratch, 'outside.json')])).toThrow('contained');
    expect(() => parseReleaseTreeArgs(['--artifact-dir', artifact, '--root', tree, '--out', 'relative'])).toThrow('absolute canonical');
  });
  test('detects byte mutations through changed digest', () => { const before = hashReleaseTree(tree); writeFileSync(resolve(tree, 'z'), 'changed'); const after = hashReleaseTree(tree); expect(after).not.toEqual(before); });
});

function hashFile(path: string) { const bytes = new Uint8Array(readFileSync(path)); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; }
function writeLogEvidence(path: string, text: string) { writeFileSync(path, text); return hashFile(path); }

describe('manifest validation and deterministic projection', () => {
  const artifact = '/tmp/di-bag-release-candidate';
  mkdirSync(artifact, { recursive: true });
  const prefix = `task2-test-${process.pid}`;
  const created: string[] = [];
  afterAll(() => { for (const path of created) rmSync(path, { force: true, recursive: true }); });
  const reviewed = collectReviewedNativeGaps(resolve(root, 'tests/types'));
  function validInput(): ReleaseEvidenceInput {
    const packages = (['di-bag', 'sas-box', 'val-box'] as const).map(name => {
      const packageJson = JSON.stringify({ name, version: '0.1.0', main: './dist/index.js', types: './dist/index.d.ts', files: ['dist'], exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } } });
      const bytes = archiveOf([{ path: 'package/package.json', content: packageJson }, { path: 'package/dist/index.d.ts', content: 'export {}' }, { path: 'package/dist/index.js', content: 'export {}' }]);
      const archive = resolve(artifact, `${name}-0.1.0.tgz`); writeFileSync(archive, bytes); created.push(archive);
      const stdout = resolve(artifact, `${prefix}-${name}.stdout`), stderr = resolve(artifact, `${prefix}-${name}.stderr`); created.push(stdout, stderr);
      const command: ReleaseCommandEvidence = { argv: ['npm', 'run', 'build'], cwd: root, startedAt: '2026-09-08T00:00:00.000Z', finishedAt: '2026-09-08T00:00:00.001Z', elapsedMilliseconds: 1, exitCode: 0, signal: null, terminationReason: null, peakObservedRssMiB: 10, inputs: [], stdout: writeLogEvidence(stdout, 'ok\n'), stderr: writeLogEvidence(stderr, '') };
      const inspection = inspectNpmArchive(bytes), files = inspection.entries.map(entry => entry.path.slice('package/'.length));
      const result = { id: `${name}@0.1.0`, name, version: '0.1.0', size: bytes.length, unpackedSize: inspection.unpackedBytes, shasum: createHash('sha1').update(bytes).digest('hex'), integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`, filename: `${name}-0.1.0.tgz`, files: files.map(path => ({ path, size: inspection.entries.find(entry => entry.path === `package/${path}`)!.bytes, mode: 420 })), entryCount: files.length, bundled: [] };
      return { name, version: '0.1.0', archive, checkout: { path: root, branch: 'feat/v0.1', candidateSourceCommit: 'a'.repeat(40), status: '' }, pack: { dryRunJson: [result], packJson: [structuredClone(result)], packedAt: '2026-09-08T00:00:01.000Z' }, commands: [command] };
    });
    return { schemaVersion: 1, generatedAt: '2026-09-08T00:00:02.000Z', artifactDirectory: artifact, tools: { node: 'v24', npm: '11', bun: '1.4.0', classic6: '6.0.2', native7: '7.0.2', sasBoxTypeScript: '5.9.3', valBoxTypeScript: '5.9.3' }, nativeDiagnostics: { reviewedAt: '2026-09-08T00:00:00.000Z', reviewedGaps: reviewed, freshGaps: reviewed.slice(0, 2) }, handoff: { candidateSourceCommit: 'a'.repeat(40), handoffCommit: 'b'.repeat(40), changedPaths: [...APPROVED_HANDOFF_PATHS] }, packages };
  }
  test('derives immutable archive facts and is deterministic across caller ordering', () => {
    const input = validInput(), first = createReleaseManifest(input); const reordered: any = structuredClone(input); reordered.packages.reverse(); reordered.nativeDiagnostics.reviewedGaps.reverse();
    const second = createReleaseManifest(reordered); expect(serializeStable(first)).toBe(serializeStable(second));
    expect(first.packages.map(item => item.name)).toEqual(['di-bag', 'sas-box', 'val-box']);
    for (const item of first.packages) { expect(item.sha256).toMatch(/^[0-9a-f]{64}$/); expect(item.sha512).toMatch(/^[0-9a-f]{128}$/); expect(item.integrity).toStartWith('sha512-'); expect(item.files).toEqual(['dist/index.d.ts', 'dist/index.js', 'package.json']); }
  });
  test('public evidence has no absolute paths and is invariant to final commit and approved observed diff', () => {
    const input = validInput(), manifest = createReleaseManifest(input), first = serializeStable(createPublicReleaseEvidence(manifest));
    expect(first).not.toContain(root); expect(first).not.toContain(artifact); expect(first).not.toContain(manifest.handoff.handoffCommit); expect(first).toContain('allowedHandoffPaths');
    const changed: any = structuredClone(input); changed.handoff.handoffCommit = 'c'.repeat(40); changed.handoff.changedPaths = [];
    expect(serializeStable(createPublicReleaseEvidence(createReleaseManifest(changed)))).toBe(first);
  });
  test('rejects duplicate/missing packages, bad versions, metadata, pack facts and handoff paths', () => {
    for (const mutate of [
      (value: any) => value.packages.pop(),
      (value: any) => { value.packages[1] = structuredClone(value.packages[0]); },
      (value: any) => { value.packages[0].version = '9.9.9'; },
      (value: any) => { value.packages[0].pack.packJson[0].size++; },
      (value: any) => { value.packages[0].pack.packJson[0].id = 'wrong@0.1.0'; },
      (value: any) => { value.packages[0].pack.packJson[0].entryCount++; },
      (value: any) => { value.packages[0].pack.packJson[0].files[0].size++; },
      (value: any) => { value.packages[0].pack.packJson[0].files[0].mode = 511; },
      (value: any) => { value.packages[0].pack.dryRunJson[0].files.pop(); },
      (value: any) => { value.packages[0].pack.packedAt = 'not-date'; },
      (value: any) => { delete value.packages[0].checkout.branch; },
      (value: any) => { delete value.packages[0].checkout.status; },
      (value: any) => { value.handoff.changedPaths.push('src/index.ts'); },
      (value: any) => { value.tools.native7 = ''; },
    ]) { const value: any = structuredClone(validInput()); mutate(value); expect(() => createReleaseManifest(value)).toThrow(); }
  });
  test('rejects new, changed, duplicate and count-changed native occurrences while accepting zero', () => {
    const empty: any = structuredClone(validInput()); empty.nativeDiagnostics.freshGaps = []; expect(() => createReleaseManifest(empty)).not.toThrow();
    for (const mutate of [
      (value: any) => { value.nativeDiagnostics.freshGaps[0].fixture = 'negative/moved.ts'; },
      (value: any) => { value.nativeDiagnostics.freshGaps[0].normalizedMessage += 'x'; },
      (value: any) => { value.nativeDiagnostics.freshGaps.push(structuredClone(value.nativeDiagnostics.freshGaps[0])); },
      (value: any) => { value.nativeDiagnostics.reviewedGaps.pop(); },
    ]) { const value: any = structuredClone(validInput()); mutate(value); expect(() => createReleaseManifest(value)).toThrow(); }
  });
  test('rejects failed, malformed-time, duplicate-input and mutated-log command evidence', () => {
    for (const mutate of [
      (command: any) => { command.exitCode = 1; }, (command: any) => { command.signal = 'SIGTERM'; }, (command: any) => { command.terminationReason = 'timeout'; },
      (command: any) => { command.finishedAt = '2026-09-07T00:00:00.000Z'; }, (command: any) => { command.elapsedMilliseconds = 9000; },
      (command: any) => { command.inputs = [{ ...command.stdout }, { ...command.stdout }]; }, (command: any) => { command.stdout.sha256 = '0'.repeat(64); },
    ]) { const value: any = structuredClone(validInput()); mutate(value.packages[0].commands[0]); expect(() => createReleaseManifest(value)).toThrow(); }
    const duplicateLogs: any = structuredClone(validInput()); duplicateLogs.packages[1].commands[0].stdout = duplicateLogs.packages[0].commands[0].stdout;
    expect(() => createReleaseManifest(duplicateLogs)).toThrow('duplicate retained command log');
  });
  test('rejects archive containment, symlink escape, absence and replacement facts', () => {
    const outside = resolve(scratch, 'outside.tgz'); writeFileSync(outside, archiveOf([{ path: 'package/package.json', content: minimalPackage() }]));
    const value: any = structuredClone(validInput()); value.packages[0].archive = outside; expect(() => createReleaseManifest(value)).toThrow('outside');
    const link = resolve(artifact, `${prefix}-link.tgz`); symlinkSync(outside, link); created.push(link); value.packages[0].archive = link; expect(() => createReleaseManifest(value)).toThrow(/symlink|realpath/);
    value.packages[0].archive = resolve(artifact, 'absent.tgz'); expect(() => createReleaseManifest(value)).toThrow();
  });
  test('manifest CLI rejects every non-fixed public target form', () => {
    expect(() => parseManifestArgs(['--input', '/tmp/i', '--out', '/tmp/o', '--public-out', '/tmp/public.json'])).toThrow('public output');
    expect(() => parseManifestArgs(['--input', '/tmp/i', '--out', '/tmp/o', '--public-out', '../docs/reports/2026-09-08-release-candidate-evidence.json'])).toThrow('public output');
    expect(() => parseManifestArgs(['--input', '/tmp/i', '--out', '/tmp/o', '--public-out', 'docs/reports/other.json'])).toThrow('public output');
    expect(parseManifestArgs(['--input', '/tmp/i', '--out', '/tmp/o', '--public-out', 'docs/reports/2026-09-08-release-candidate-evidence.json']).publicOut).toBe(resolve(root, 'docs/reports/2026-09-08-release-candidate-evidence.json'));
    const checkout = resolve(scratch, 'public-link-checkout'), reports = resolve(checkout, 'docs/reports'); mkdirSync(reports, { recursive: true });
    symlinkSync(resolve(scratch, 'outside-public'), resolve(reports, '2026-09-08-release-candidate-evidence.json'));
    expect(() => parseManifestArgs(['--input', '/tmp/i', '--out', '/tmp/o', '--public-out', 'docs/reports/2026-09-08-release-candidate-evidence.json'], checkout)).toThrow('symlink');
  });
});

describe('final release audit', () => {
  const checkout = resolve(scratch, 'audit-checkout'), reports = resolve(checkout, 'docs/reports'), recordsDir = resolve(scratch, 'audit-records');
  mkdirSync(reports, { recursive: true }); mkdirSync(recordsDir);
  const manifest = resolve(scratch, 'audit-manifest.json'), publicEvidence = resolve(reports, '2026-09-08-release-candidate-evidence.json');
  writeFileSync(manifest, '{}\n'); writeFileSync(publicEvidence, '{}\n');
  const candidate = '1'.repeat(40), handoff = '2'.repeat(40);
  function argsAndRecords() {
    const manifestHash = hashFile(manifest), publicHash = hashFile(publicEvidence), inputs = [manifestHash, publicHash];
    const roles: Array<[string, readonly string[], string]> = [
      ['head', ['git', 'rev-parse', 'HEAD'], `${handoff}\n`], ['diff', ['git', 'diff', '--name-only', `${candidate}..${handoff}`], `${APPROVED_HANDOFF_PATHS.join('\n')}\n`],
      ['status', ['git', 'status', '--short'], '?? docs/reports/2026-09-08-execution-handoff.md\n'], ['tests', ['bun', 'test', 'tests/release-artifacts.test.ts'], 'pass\n'],
      ['verifier', ['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/verify-release-artifacts.ts', '--manifest', manifest, '--work-dir', '/tmp/di-bag-release-candidate/final-work'], '{"ok":true}\n'],
    ];
    const records = roles.map(([name, argv, output]) => {
      const stdoutPath = resolve(recordsDir, `${name}.stdout`), stderrPath = resolve(recordsDir, `${name}.stderr`), recordPath = resolve(recordsDir, `${name}.json`);
      const record: ReleaseCommandEvidence = { argv, cwd: checkout, startedAt: '2026-09-08T00:00:00.000Z', finishedAt: '2026-09-08T00:00:00.001Z', elapsedMilliseconds: 1, exitCode: 0, signal: null, terminationReason: null, peakObservedRssMiB: 1, inputs, stdout: writeLogEvidence(stdoutPath, output), stderr: writeLogEvidence(stderrPath, '') };
      writeFileSync(recordPath, `${JSON.stringify(record)}\n`); return recordPath;
    });
    const out = '/tmp/di-bag-release-candidate/final-audit.json';
    return { records, manifest, publicEvidence, candidateCommit: candidate, handoffCommit: handoff, out } as const;
  }
  test('validates exactly five roles and produces deterministic non-self-attestation', () => { const args = argsAndRecords(); expect(createReleaseAudit(args)).toEqual(createReleaseAudit(args)); expect(JSON.stringify(createReleaseAudit(args))).not.toContain(args.out); });
  test('rejects missing, duplicate, failed, mutated, stale-input and wrong-Git evidence', () => {
    { const args: any = argsAndRecords(); args.records.pop(); expect(() => createReleaseAudit(args)).toThrow(/missing|five/); }
    { const args: any = argsAndRecords(); args.records[4] = args.records[0]; expect(() => createReleaseAudit(args)).toThrow(/duplicate|missing/); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); record.exitCode = 1; writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow('failed'); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); writeFileSync(record.stdout.path, 'wrong\n'); expect(() => createReleaseAudit(args)).toThrow('mutated'); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); record.inputs[0].sha256 = '0'.repeat(64); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow('stale'); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); writeFileSync(record.stdout.path, `${candidate}\n`); record.stdout = hashFile(record.stdout.path); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow('HEAD'); }
  });
  test('audit CLI rejects wrong output, public location, OIDs, duplicate and extra options', () => {
    const base = ['--record', '/tmp/1', '--record', '/tmp/2', '--record', '/tmp/3', '--record', '/tmp/4', '--record', '/tmp/5', '--manifest', manifest, '--public-evidence', publicEvidence, '--candidate-commit', candidate, '--handoff-commit', handoff, '--out', '/tmp/di-bag-release-candidate/final-audit.json'];
    expect(parseReleaseAuditArgs(base).records).toHaveLength(5);
    expect(() => parseReleaseAuditArgs(base.slice(0, -1).concat('/tmp/other'))).toThrow('output');
    expect(() => parseReleaseAuditArgs(base.map(value => value === publicEvidence ? manifest : value))).toThrow('fixed sanitized');
    expect(() => parseReleaseAuditArgs(base.map(value => value === candidate ? 'short' : value))).toThrow('OIDs');
    expect(() => parseReleaseAuditArgs(base.concat('--execute', 'x'))).toThrow('unsupported');
  });
});
