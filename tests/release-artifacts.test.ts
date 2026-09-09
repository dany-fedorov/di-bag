import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { inspectNpmArchive } from '../scripts/release-archive.ts';
import { createPublicReleaseEvidence, createReleaseManifest, parseManifestArgs, serializeStable, type ReleaseEvidenceInput, type ReleaseManifest } from '../scripts/create-release-manifest.ts';
import { assertSafeReleaseArgv, parseReleaseCommandArgs, runReleaseCommand, type ReleaseCommandEvidence } from '../scripts/run-release-command.ts';
import { collectFreshNativeGaps, collectReviewedNativeGaps, createNativeInventory, parseNativeInventoryArgs } from '../scripts/release-native-inventory.ts';
import { APPROVED_HANDOFF_PATHS, createReleaseAudit, parseReleaseAuditArgs } from '../scripts/create-release-audit.ts';
import { hashReleaseTree, parseReleaseTreeArgs } from '../scripts/hash-release-tree.ts';
import { matchesReleaseNegativeDiagnostics, parseVerifyReleaseArgs, releaseInstallArgv, traceInstalledRoot, verifyReleaseArtifacts, verifyReleaseManifestStatic, VERIFY_RELEASE_USAGE } from '../scripts/verify-release-artifacts.ts';
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
const adversarialReleaseFiles = [
  'tests/final-adversarial-integration.test.ts',
  'tests/box-package.test.ts',
  'tests/package.test.ts',
  'tests/native-package.test.ts',
] as const;

function validateAdversarialReleaseCommands(document: string): readonly string[] {
  const failures: string[] = [], roles: string[] = [];
  for (const match of document.matchAll(/bun test ([^`\n;]+)/g)) {
    const argv = ['bun', 'test', ...match[1]!.trim().split(/\s+/)];
    const relevant = argv.filter(token => adversarialReleaseFiles.includes(token as typeof adversarialReleaseFiles[number]));
    if (!relevant.length) continue;
    if (argv.length !== 3 || relevant.length !== 1) failures.push(`adversarial role must be one exact file: ${argv.join(' ')}`);
    roles.push(...relevant);
  }
  if (roles.length !== adversarialReleaseFiles.length || [...roles].sort().join('\n') !== [...adversarialReleaseFiles].sort().join('\n'))
    failures.push('adversarial roles must equal the four-file inventory exactly once');
  return failures;
}

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
  test('adversarial release gates are four separately supervised file commands', () => {
    const publishing = readFileSync(resolve(root, 'PUBLISHING.md'), 'utf8');
    const handoff = readFileSync(resolve(root, 'docs/superpowers/plans/2026-09-08-release-handoff.md'), 'utf8');
    const design = readFileSync(resolve(root, 'docs/superpowers/specs/2026-09-08-release-handoff-design.md'), 'utf8');
    for (const document of [publishing, handoff, design]) expect(validateAdversarialReleaseCommands(document)).toEqual([]);
    const first = `bun test ${adversarialReleaseFiles[0]}`;
    for (const invalid of [
      publishing.replace(first, `bun test ${adversarialReleaseFiles[1]} ${adversarialReleaseFiles[0]}`),
      publishing.replace(first, `bun test ${adversarialReleaseFiles[0]} ${adversarialReleaseFiles[2]} ${adversarialReleaseFiles[3]}`),
      publishing.replace(first, `bun test --rerun-each 1 ${adversarialReleaseFiles[0]}`),
      publishing.replace(first, ''),
      publishing.replace(first, `${first}\n${first}`),
    ]) expect(validateAdversarialReleaseCommands(invalid).length).toBeGreaterThan(0);
    expect(handoff).toContain('four separately supervised');
    expect(handoff).toContain('4096 MiB');
  });

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

describe('archive verifier TDD boundary', () => {
  test('exports a read-only verifier and strict CLI parser', () => {
    expect(typeof verifyReleaseArtifacts).toBe('function');
    expect(typeof parseVerifyReleaseArgs).toBe('function');
  });
});

const scratch = mkdtempSync(join(tmpdir(), 'di-bag-release-tests-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function tarField(header: Uint8Array, offset: number, length: number, value: string): void {
  header.set(Buffer.from(value), offset); header[Math.min(offset + value.length, offset + length - 1)] = 0;
}
function archiveOf(entries: readonly Readonly<{ path: string; content: string; type?: number; declaredSize?: number }>[], options: Readonly<{ badChecksum?: boolean; badMagic?: boolean; badNumericSuffix?: boolean; nonzeroPadding?: boolean; terminators?: number; trailing?: string }> = {}): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    const header = new Uint8Array(512); tarField(header, 0, 100, entry.path); tarField(header, 100, 8, '0000644'); tarField(header, 108, 8, '0000000'); tarField(header, 116, 8, '0000000');
    const content = new TextEncoder().encode(entry.content), size = entry.declaredSize ?? content.length;
    tarField(header, 124, 12, size.toString(8).padStart(11, '0')); tarField(header, 136, 12, '00000000000'); header.fill(32, 148, 156); header[156] = entry.type ?? 48; tarField(header, 257, 6, options.badMagic ? 'bad!!' : 'ustar'); header.set(new TextEncoder().encode('00'), 263);
    if (options.badNumericSuffix) header[155] = 88;
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
    ['numeric NUL suffix', () => archiveOf([{ path: 'package/package.json', content: minimalPackage() }], { badNumericSuffix: true }), 'NUL suffix'],
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
    ['env', 'npm', 'publish', 'x.tgz'], ['env', 'git', 'push'], ['npx', 'npm', 'view', 'di-bag'], ['bunx', 'tool'], ['corepack', 'npm', 'login'],
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
  test('failed reruns and thrown supervisors erase stale success evidence', async () => {
    const record = resolve(artifact, 'rerun.json');
    const success = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', record, '--cwd', cwd, '--', process.execPath, '-e', 'console.log("old success")']);
    await runReleaseCommand(success, { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 }); expect(Bun.file(record).size).toBeGreaterThan(0);
    const failure = parseReleaseCommandArgs(['--artifact-dir', artifact, '--record', record, '--cwd', cwd, '--', process.execPath, '-e', 'process.exit(9)']);
    await expect(runReleaseCommand(failure, { timeoutMilliseconds: 5_000, maxRssMiB: 1024, maxOutputBytes: 1024, sampleMilliseconds: 5 })).rejects.toThrow('exit 9');
    for (const path of [record, `${record}.stdout`, `${record}.stderr`]) expect(Bun.file(path).size).toBe(0);
    writeFileSync(record, 'stale'); writeFileSync(`${record}.stdout`, 'stale'); writeFileSync(`${record}.stderr`, 'stale');
    const throwing: any = async () => { throw new Error('supervisor exploded'); };
    await expect(runReleaseCommand(success, { timeoutMilliseconds: 1, maxRssMiB: 1, maxOutputBytes: 1, sampleMilliseconds: 1 }, throwing)).rejects.toThrow('exploded');
    for (const path of [record, `${record}.stdout`, `${record}.stderr`]) expect(Bun.file(path).size).toBe(0);
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
  const syntheticRoot = resolve(scratch, 'synthetic-native-gap-authority');
  mkdirSync(syntheticRoot);
  writeFileSync(resolve(syntheticRoot, 'legacy.ts'), '// diagnostic: legacy failure\n// diagnostic-native-gap: last-token-string\nconst legacy = true;\n');
  test('freezes the exact current zero-gap source authority', () => {
    expect(Object.isFrozen(nativeDiagnosticGapMessages)).toBe(true);
    const gaps = collectReviewedNativeGaps(reviewedRoot); expect(gaps).toEqual([]); expect(Object.isFrozen(gaps)).toBe(true);
  });
  test('accepts empty and reviewed fresh inventory while an empty authority rejects a new gap', () => {
    const reviewed = collectReviewedNativeGaps(syntheticRoot), first = reviewed[0]!;
    expect(reviewed).toHaveLength(1); expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(collectFreshNativeGaps('', reviewed)).toEqual([]);
    const row = JSON.stringify({ fixture: first.fixture, gaps: [{ id: first.id, primary: { line: first.markerLine - 1 }, diagnostic: { code: 2769, message: first.normalizedMessage } }] });
    expect(collectFreshNativeGaps(row, reviewed)).toEqual([first]);
    expect(() => collectFreshNativeGaps(row, [])).toThrow('new or moved native gap occurrence');
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
  const archiveSnapshots = packageNames.map(name => {
    const path = resolve(artifact, `${name}-0.1.0.tgz`);
    return { path, existed: existsSync(path), bytes: existsSync(path) ? readFileSync(path) : undefined };
  });
  const fixtureArtifact = resolve(artifact, prefix);
  mkdirSync(fixtureArtifact);
  afterAll(() => rmSync(fixtureArtifact, { force: true, recursive: true }));
  const reviewed = collectReviewedNativeGaps(resolve(root, 'tests/types'));
  function validInput(): ReleaseEvidenceInput {
    const packages = (['di-bag', 'sas-box', 'val-box'] as const).map(name => {
      const packageJson = JSON.stringify({ name, version: '0.1.0', main: './dist/index.js', types: './dist/index.d.ts', files: ['dist'], exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } } });
      const bytes = archiveOf([{ path: 'package/package.json', content: packageJson }, { path: 'package/dist/index.d.ts', content: 'export {}' }, { path: 'package/dist/index.js', content: 'export {}' }]);
      const archive = resolve(fixtureArtifact, `${name}-0.1.0.tgz`); writeFileSync(archive, bytes);
      const stdout = resolve(fixtureArtifact, `${name}.stdout`), stderr = resolve(fixtureArtifact, `${name}.stderr`);
      const command: ReleaseCommandEvidence = { argv: ['npm', 'run', 'build'], cwd: root, startedAt: '2026-09-08T00:00:00.000Z', finishedAt: '2026-09-08T00:00:00.001Z', elapsedMilliseconds: 1, exitCode: 0, signal: null, terminationReason: null, peakObservedRssMiB: 10, inputs: [], stdout: writeLogEvidence(stdout, 'ok\n'), stderr: writeLogEvidence(stderr, '') };
      const inspection = inspectNpmArchive(bytes), files = inspection.entries.map(entry => entry.path.slice('package/'.length));
      const result = { id: `${name}@0.1.0`, name, version: '0.1.0', size: bytes.length, unpackedSize: inspection.unpackedBytes, shasum: createHash('sha1').update(bytes).digest('hex'), integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`, filename: `${name}-0.1.0.tgz`, files: files.map(path => ({ path, size: inspection.entries.find(entry => entry.path === `package/${path}`)!.bytes, mode: 420 })), entryCount: files.length, bundled: [] };
      return { name, version: '0.1.0', archive, checkout: { path: root, branch: 'feat/v0.1', candidateSourceCommit: 'a'.repeat(40), status: '' }, pack: { dryRunJson: [result], packJson: [structuredClone(result)], packedAt: '2026-09-08T00:00:01.000Z' }, commands: [command] };
    });
    return { schemaVersion: 1, generatedAt: '2026-09-08T00:00:02.000Z', artifactDirectory: artifact, tools: { node: 'v24', npm: '11', bun: '1.4.0', classic6: '6.0.2', native7: '7.0.2', sasBoxTypeScript: '5.9.3', valBoxTypeScript: '5.9.3' }, nativeDiagnostics: { reviewedAt: '2026-09-08T00:00:00.000Z', reviewedGaps: reviewed, freshGaps: reviewed.slice(0, 2) }, handoff: { candidateSourceCommit: 'a'.repeat(40), handoffCommit: 'b'.repeat(40), changedPaths: [...APPROVED_HANDOFF_PATHS] }, packages };
  }
  test('manifest fixtures leave root candidate archive existence and bytes unchanged', () => {
    validInput();
    for (const snapshot of archiveSnapshots) {
      expect(existsSync(snapshot.path)).toBe(snapshot.existed);
      if (snapshot.existed) expect(readFileSync(snapshot.path)).toEqual(snapshot.bytes!);
    }
  });
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
  test('accepts zero reviewed and fresh native gaps and rejects every unexpected fresh occurrence', () => {
    const empty: any = structuredClone(validInput()); expect(() => createReleaseManifest(empty)).not.toThrow();
    const unexpected: any = structuredClone(validInput());
    unexpected.nativeDiagnostics.freshGaps = [{ id: 'last-token-string', fixture: 'negative/replacement.ts', markerLine: 2, markerOccurrence: 1, code: 2769, normalizedMessage: nativeDiagnosticGapMessages['last-token-string'], fingerprint: '0'.repeat(64) }];
    expect(() => createReleaseManifest(unexpected)).toThrow();
  });
  test('retains nonempty-authority manifest validation for historical candidates', () => {
    const checkout = resolve(fixtureArtifact, 'historical-checkout');
    mkdirSync(resolve(checkout, 'tests/types'), { recursive: true });
    writeFileSync(resolve(checkout, 'tests/types/replacement.ts'), '// diagnostic: legacy failure\n// diagnostic-native-gap: last-token-string\n');
    const input: any = structuredClone(validInput());
    input.packages.find((item: any) => item.name === 'di-bag').checkout.path = checkout;
    input.nativeDiagnostics.reviewedGaps = collectReviewedNativeGaps(resolve(checkout, 'tests/types'));
    input.nativeDiagnostics.freshGaps = structuredClone(input.nativeDiagnostics.reviewedGaps);
    expect(() => createReleaseManifest(input)).not.toThrow();
    for (const mutate of [
      (value: any) => { value.nativeDiagnostics.freshGaps[0].fixture = 'negative/moved.ts'; },
      (value: any) => { value.nativeDiagnostics.freshGaps[0].normalizedMessage += 'x'; },
      (value: any) => { value.nativeDiagnostics.freshGaps.push(structuredClone(value.nativeDiagnostics.freshGaps[0])); },
      (value: any) => { value.nativeDiagnostics.reviewedGaps.pop(); },
    ]) { const value: any = structuredClone(input); mutate(value); expect(() => createReleaseManifest(value)).toThrow(); }
    const replaced: any = structuredClone(input), gap = replaced.nativeDiagnostics.reviewedGaps[0]; replaced.nativeDiagnostics.freshGaps = []; gap.fixture = 'negative/replaced.ts';
    gap.fingerprint = createHash('sha256').update(JSON.stringify({ id: gap.id, fixture: gap.fixture, markerLine: gap.markerLine, markerOccurrence: gap.markerOccurrence, code: gap.code, normalizedMessage: gap.normalizedMessage })).digest('hex');
    expect(() => createReleaseManifest(replaced)).toThrow('frozen source authority');
    const traversal: any = structuredClone(input); traversal.nativeDiagnostics.reviewedGaps[0].fixture = '../escape.ts';
    expect(() => createReleaseManifest(traversal)).toThrow('changed reviewed native fingerprint');
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
    const link = resolve(fixtureArtifact, 'link.tgz'); symlinkSync(outside, link); value.packages[0].archive = link; expect(() => createReleaseManifest(value)).toThrow(/symlink|realpath/);
    value.packages[0].archive = resolve(fixtureArtifact, 'absent.tgz'); expect(() => createReleaseManifest(value)).toThrow();
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
  test('public projection rejects absolute argv and input paths outside known roots', () => {
    const executableInput: any = validInput(); executableInput.packages[0].commands[0].argv = ['/usr/bin/node', '-v'];
    expect(() => createPublicReleaseEvidence(createReleaseManifest(executableInput))).toThrow('unsanitized absolute path');
    const external: any = validInput(); external.packages[0].commands[0].inputs = [hashFile('/etc/hosts')];
    expect(() => createPublicReleaseEvidence(createReleaseManifest(external))).toThrow('unsanitized absolute path');
    const quoted: any = validInput(); quoted.packages[0].commands[0].argv = ['node', '--config="/etc/secret"'];
    expect(() => createPublicReleaseEvidence(createReleaseManifest(quoted))).toThrow('unsanitized absolute path');
    const extraPackField: any = validInput(); extraPackField.packages[0].pack.packJson[0].hostPath = '/etc/secret'; extraPackField.packages[0].pack.dryRunJson[0].hostPath = '/etc/secret';
    const projected = serializeStable(createPublicReleaseEvidence(createReleaseManifest(extraPackField)));
    expect(projected).not.toContain('/etc/secret'); expect(projected).not.toContain('dryRunJson'); expect(projected).not.toContain('packJson');
  });
});

describe('archive verifier', () => {
  const artifact = '/tmp/di-bag-release-candidate';
  const directory = resolve(artifact, `task3-test-${process.pid}`);
  const checkout = resolve(directory, 'checkout');
  const reports = resolve(checkout, 'docs/reports');
  const manifestPath = resolve(directory, 'candidate.json');
  const publicPath = resolve(reports, '2026-09-08-release-candidate-evidence.json');
  let manifest: ReleaseManifest;

  function packResult(name: string, archivePath: string) {
    const bytes = new Uint8Array(readFileSync(archivePath)), inspection = inspectNpmArchive(bytes);
    return { id: `${name}@0.1.0`, name, version: '0.1.0', filename: `${name}-0.1.0.tgz`, size: bytes.length, unpackedSize: inspection.unpackedBytes,
      shasum: createHash('sha1').update(bytes).digest('hex'), integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
      files: inspection.entries.map(entry => ({ path: entry.path.slice(8), size: entry.bytes, mode: entry.mode })), entryCount: inspection.entries.length, bundled: [] };
  }
  function publish(value: ReleaseManifest): void {
    writeFileSync(publicPath, serializeStable(createPublicReleaseEvidence(value)));
  }
  function staticFailures(mutate: (value: any) => void): readonly string[] {
    const value: any = structuredClone(manifest); mutate(value); publish(value); return verifyReleaseManifestStatic(value).failures;
  }
  function writeCandidate(value: ReleaseManifest, suffix: string): string {
    const path = resolve(directory, `${suffix}.json`); writeFileSync(path, serializeStable(value)); publish(value); return path;
  }
  function replaceArchive(value: any, packageName: string, bytes: Uint8Array, suffix: string): void {
    const record = value.packages.find((item: any) => item.name === packageName), path = resolve(directory, `${suffix}.tgz`); writeFileSync(path, bytes);
    record.archive = path; record.bytes = bytes.length; record.sha256 = createHash('sha256').update(bytes).digest('hex'); record.sha512 = createHash('sha512').update(bytes).digest('hex'); record.integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  }
  function adoptArchive(value: any, packageName: string, bytes: Uint8Array, suffix: string): void {
    replaceArchive(value, packageName, bytes, suffix); const record = value.packages.find((item: any) => item.name === packageName), inspection = inspectNpmArchive(bytes), metadata = JSON.parse(new TextDecoder().decode(inspection.packageJson));
    record.files = inspection.entries.map(entry => entry.path.slice(8)).sort();
    record.packageMetadata = { name: metadata.name, version: metadata.version, ...(typeof metadata.main === 'string' ? { main: metadata.main } : {}), ...(typeof metadata.types === 'string' ? { types: metadata.types } : {}), files: [...(metadata.files ?? [])].sort(), exports: metadata.exports ?? null, dependencies: metadata.dependencies ?? {}, peerDependencies: metadata.peerDependencies ?? {}, optionalDependencies: metadata.optionalDependencies ?? {}, bundledDependencies: [...(metadata.bundledDependencies ?? [])].sort() };
    const result = packResult(packageName, record.archive); record.pack.dryRunJson = [result]; record.pack.packJson = [structuredClone(result)];
  }
  function archiveEntries(packageName: string): Array<{ path: string; content: string }> {
    const record = manifest.packages.find(item => item.name === packageName)!; return inspectNpmArchive(new Uint8Array(readFileSync(record.archive))).entries.map(entry => ({ path: entry.path, content: new TextDecoder().decode(entry.content) }));
  }

  beforeAll(() => {
    rmSync(directory, { recursive: true, force: true }); mkdirSync(reports, { recursive: true });
    process.env.npm_config_cache = resolve(directory, '.npm-cache');
    cpSync(resolve(root, 'tests/types'), resolve(checkout, 'tests/types'), { recursive: true }); symlinkSync(resolve(root, 'node_modules'), resolve(checkout, 'node_modules'));
    symlinkSync(resolve(root, 'tests/final-adversarial-runtime-fixture.ts'), resolve(checkout, 'tests/final-adversarial-runtime-fixture.ts'));
    const diPack = spawnSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], { cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_cache: resolve(directory, '.npm-cache') } });
    if (diPack.status !== 0) throw new Error(`task3 DI pack setup failed: ${diPack.stdout}\n${diPack.stderr}`);
    for (const name of ['sas-box', 'val-box'] as const) cpSync(resolve(root, `tests/fixtures/box-packages/${name}-0.1.0.tgz`), resolve(directory, `${name}-0.1.0.tgz`));
    const reviewed = collectReviewedNativeGaps(resolve(root, 'tests/types'));
    const packages = (['di-bag', 'sas-box', 'val-box'] as const).map(name => {
      const archive = resolve(directory, `${name}-0.1.0.tgz`), stdout = resolve(directory, `${name}.stdout`), stderr = resolve(directory, `${name}.stderr`), result = packResult(name, archive);
      const command: ReleaseCommandEvidence = { argv: ['npm', 'run', 'build'], cwd: name === 'di-bag' ? checkout : resolve(root, `.related-repos/${name}`), startedAt: '2026-09-08T00:00:00.000Z', finishedAt: '2026-09-08T00:00:00.001Z', elapsedMilliseconds: 1, exitCode: 0, signal: null, terminationReason: null, peakObservedRssMiB: 10, inputs: [], stdout: writeLogEvidence(stdout, 'ok\n'), stderr: writeLogEvidence(stderr, '') };
      return { name, version: '0.1.0', archive, checkout: { path: name === 'di-bag' ? checkout : resolve(root, `.related-repos/${name}`), branch: 'feat/v0.1', candidateSourceCommit: 'a'.repeat(40), status: '' }, pack: { dryRunJson: [result], packJson: [structuredClone(result)], packedAt: '2026-09-08T00:00:01.000Z' }, commands: [command] };
    });
    const versionOf = (executable: string, argv = ['--version']) => {
      const result = spawnSync(executable, argv, { cwd: root, encoding: 'utf8' });
      const version = result.stdout.trim().replace(/^Version /, '');
      if (result.status !== 0 || result.error || !version) throw new Error(`compiler version probe failed: ${result.error ?? result.stderr}`);
      return version;
    };
    manifest = createReleaseManifest({ schemaVersion: 1, generatedAt: '2026-09-08T00:00:02.000Z', artifactDirectory: artifact, tools: { node: process.version, npm: '11', bun: Bun.version, classic6: versionOf('node', [resolve(root, 'node_modules/typescript/bin/tsc6'), '--version']), native7: versionOf(resolve(root, 'node_modules/.bin/tsc')), sasBoxTypeScript: '5.9.3', valBoxTypeScript: '5.9.3' }, nativeDiagnostics: { reviewedAt: '2026-09-08T00:00:00.000Z', reviewedGaps: reviewed, freshGaps: reviewed }, handoff: { candidateSourceCommit: 'a'.repeat(40), handoffCommit: 'b'.repeat(40), changedPaths: [...APPROVED_HANDOFF_PATHS] }, packages });
    writeFileSync(manifestPath, serializeStable(manifest)); publish(manifest);
  });
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  test('independently accepts exact archive, pack, metadata, export, dependency, and public facts', () => {
    publish(manifest); expect(verifyReleaseManifestStatic(manifest).failures).toEqual([]);
  });
  test('rejects every archive digest and file-list mismatch', () => {
    for (const mutate of [(r: any) => r.bytes++, (r: any) => r.sha256 = '0'.repeat(64), (r: any) => r.sha512 = '0'.repeat(128), (r: any) => r.integrity = 'sha512-bad', (r: any) => r.files.pop()]) {
      const failures = staticFailures(value => mutate(value.packages[0])); expect(failures.length).toBeGreaterThan(0);
    }
  });
  test('rejects altered, duplicate, stale, divergent, extra-field, and filename pack JSON', () => {
    const cases: Array<(record: any) => void> = [
      r => r.pack.packJson[0].size++, r => r.pack.packJson.push(structuredClone(r.pack.packJson[0])), r => r.pack.dryRunJson[0].shasum = 'bad',
      r => r.pack.dryRunJson[0].files.pop(), r => r.pack.packJson[0].filename = 'surprise.tgz', r => r.pack.packJson[0].hostPath = '/etc/secret',
      r => r.pack.packJson[0].files[0].extra = true,
    ];
    for (const mutate of cases) expect(staticFailures(value => mutate(value.packages[0])).some(failure => failure.includes('pack'))).toBe(true);
  });
  test('enforces exact DI and box package metadata, exports, entry counts, and empty dependencies', () => {
    const cases: Array<[string, (record: any) => void]> = [
      ['main/types', r => r.packageMetadata.main = './wrong.js'], ['files', r => r.packageMetadata.files = ['dist', 'src']], ['exports', r => r.packageMetadata.exports = { '.': './dist/index.js' }],
      ['dependencies', r => r.packageMetadata.dependencies = { surprise: '1.0.0' }], ['peerDependencies', r => r.packageMetadata.peerDependencies = { surprise: '1.0.0' }],
      ['optionalDependencies', r => r.packageMetadata.optionalDependencies = { surprise: '1.0.0' }], ['bundledDependencies', r => r.packageMetadata.bundledDependencies = ['surprise']],
    ];
    for (const packageName of ['di-bag', 'sas-box', 'val-box']) for (const [, mutate] of cases) {
      const failures = staticFailures(value => mutate(value.packages.find((record: any) => record.name === packageName))); expect(failures.length).toBeGreaterThan(0);
    }
  });
  test('rejects malformed dependency, files, and bundled dependency metadata shapes', () => {
    publish(manifest);
    for (const [field, malformed] of [['dependencies', []], ['peerDependencies', ['x']], ['optionalDependencies', 1], ['files', {}], ['bundledDependencies', {}]] as const) {
      const value: any = structuredClone(manifest), entries = archiveEntries('di-bag'), packageEntry = entries.find(entry => entry.path === 'package/package.json')!, metadata = JSON.parse(packageEntry.content); metadata[field] = malformed; packageEntry.content = JSON.stringify(metadata);
      replaceArchive(value, 'di-bag', archiveOf(entries), `malformed-${field}`); expect(verifyReleaseManifestStatic(value).failures.some(failure => failure.includes('metadata shape'))).toBe(true);
    }
  });
  test('rejects forbidden source, test, fixture, dependency, credential, and tarball content', () => {
    for (const path of ['package/src/private.ts', 'package/test/private.js', 'package/fixtures/private.js', 'package/node_modules/x/index.js', 'package/.npmrc', 'package/credentials/token', 'package/dist/nested.tgz']) {
      const value: any = structuredClone(manifest), bytes = archiveOf([...archiveEntries('di-bag'), { path, content: 'forbidden' }]); adoptArchive(value, 'di-bag', bytes, `forbidden-${createHash('sha256').update(path).digest('hex').slice(0, 8)}`);
      expect((publish(value), verifyReleaseManifestStatic(value).failures).some(failure => failure.includes('forbidden package file'))).toBe(true);
    }
  });
  test('rejects missing DI export pairs and extra box entries from archive bytes', () => {
    { const value: any = structuredClone(manifest), bytes = archiveOf(archiveEntries('di-bag').filter(entry => entry.path !== 'package/dist/node.d.ts')); adoptArchive(value, 'di-bag', bytes, 'missing-node-types'); expect((publish(value), verifyReleaseManifestStatic(value).failures).some(failure => failure.includes('missing public export file'))).toBe(true); }
    for (const name of ['sas-box', 'val-box']) { const value: any = structuredClone(manifest), bytes = archiveOf([...archiveEntries(name), { path: 'package/dist/extra.js', content: 'export{}' }]); adoptArchive(value, name, bytes, `${name}-extra`); expect((publish(value), verifyReleaseManifestStatic(value).failures).some(failure => failure.includes('approved entries'))).toBe(true); }
  });
  test('requires byte-identical stable public evidence and rejects missing, stale, malformed, and extra bytes', () => {
    for (const bytes of ['', '{}\n', `${serializeStable(createPublicReleaseEvidence(manifest))} `, serializeStable({ ...createPublicReleaseEvidence(manifest) as any, extra: true })]) {
      writeFileSync(publicPath, bytes); expect(verifyReleaseManifestStatic(manifest).failures.some(failure => failure.includes('public evidence'))).toBe(true);
    }
    publish(manifest);
  });
  test('rejects malicious archives before creating or running a consumer workdir', async () => {
    const malicious: Array<[string, Uint8Array]> = [
      ['absolute', archiveOf([{ path: '/package/package.json', content: minimalPackage() }])],
      ['traversal', archiveOf([{ path: 'package/../escape', content: 'x' }, { path: 'package/package.json', content: minimalPackage() }])],
      ['prefix', archiveOf([{ path: 'package/a', content: 'x' }, { path: 'package/a/b', content: 'x' }, { path: 'package/package.json', content: minimalPackage() }])],
      ['directory-prefix', archiveOf([{ path: 'package/a', content: 'x' }, { path: 'package/a/b', content: '', type: 53 }, { path: 'package/package.json', content: minimalPackage() }])],
      ['symlink', archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 50 }])],
      ['hardlink', archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 49 }])],
      ['fifo', archiveOf([{ path: 'package/package.json', content: minimalPackage(), type: 54 }])],
      ['oversized', archiveOf([{ path: 'package/package.json', content: minimalPackage(), declaredSize: 129 * 1024 * 1024 }])],
      ['truncated-gzip', new Uint8Array([31, 139, 8, 0])],
    ];
    const validArchive = new Uint8Array(readFileSync(manifest.packages[0]!.archive)); malicious.push(['concatenated-gzip', new Uint8Array([...validArchive, ...validArchive])]);
    for (const [name, bytes] of malicious) {
      const value: any = structuredClone(manifest); replaceArchive(value, 'di-bag', bytes, `malicious-${name}`); const path = writeCandidate(value, `candidate-${name}`), work = resolve(directory, `work-${name}`);
      const result = await verifyReleaseArtifacts(path, work); expect(result.ok).toBe(false); expect(result.failures.some(failure => /unsafe|malformed|archive/.test(failure))).toBe(true); expect(existsSync(work)).toBe(false);
    }
    publish(manifest);
  });
  test('uses one fixed explicit offline install argv with no fallback', () => {
    expect(releaseInstallArgv(['/a.tgz', '/b.tgz'])).toEqual(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', '/a.tgz', '/b.tgz']);
  });
  test('core import tracing rejects bare, self, node builtin, and unresolved relative specifiers', () => {
    const graph = resolve(directory, 'trace'); mkdirSync(graph); writeFileSync(resolve(graph, 'local.js'), 'export{}');
    writeFileSync(resolve(graph, 'index.js'), "import './local.js';import './missing.js';import 'di-bag';import 'node:fs';import 'surprise';");
    expect(traceInstalledRoot(resolve(graph, 'index.js'))).toMatchObject({ bareImports: ['di-bag', 'node:fs', 'surprise'], unresolved: [expect.stringContaining('./missing.js')] });
  });
  test('CLI accepts only canonical contained manifest and empty work directory paths', () => {
    const work = resolve(directory, 'cli-work');
    expect(parseVerifyReleaseArgs(['--manifest', manifestPath, '--work-dir', work])).toEqual({ manifest: manifestPath, workDir: work });
    expect(parseVerifyReleaseArgs(['--help'])).toEqual({ help: true }); expect(VERIFY_RELEASE_USAGE).toContain('--manifest');
    for (const argv of [[], ['--manifest', manifestPath], ['--manifest', manifestPath, '--manifest', manifestPath], ['--manifest', manifestPath, '--work-dir', 'relative'], ['--manifest', manifestPath, '--work-dir', '/tmp/outside'], ['--manifest', manifestPath, '--work-dir', work, 'positional'], ['--candidate', manifestPath, '--work-dir', work]]) expect(() => parseVerifyReleaseArgs(argv)).toThrow();
    mkdirSync(work); writeFileSync(resolve(work, 'occupied'), 'x'); expect(() => parseVerifyReleaseArgs(['--manifest', manifestPath, '--work-dir', work])).toThrow('empty'); rmSync(work, { recursive: true });
    const alias = resolve(directory, 'manifest-alias.json'); symlinkSync(manifestPath, alias); expect(() => parseVerifyReleaseArgs(['--manifest', alias, '--work-dir', work])).toThrow();
    const help = spawnSync('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', resolve(root, 'scripts/verify-release-artifacts.ts'), '--help'], { cwd: root, encoding: 'utf8' }); expect(help).toMatchObject({ status: 0, stdout: VERIFY_RELEASE_USAGE + '\n', stderr: '' });
    const invalid = spawnSync('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', resolve(root, 'scripts/verify-release-artifacts.ts'), '--candidate', manifestPath], { cwd: root, encoding: 'utf8' }); expect(invalid.status).not.toBe(0);
  });
  test('direct verifier API rejects outside, relative, aliased, and nonempty work paths before mutation', async () => {
    publish(manifest);
    for (const work of ['relative-work', resolve(scratch, 'outside-work')]) { const result = await verifyReleaseArtifacts(manifestPath, work); expect(result.ok).toBe(false); expect(existsSync(work)).toBe(false); }
    const occupied = resolve(directory, 'api-occupied'); mkdirSync(occupied); writeFileSync(resolve(occupied, 'sentinel'), 'keep'); expect((await verifyReleaseArtifacts(manifestPath, occupied)).ok).toBe(false); expect(readFileSync(resolve(occupied, 'sentinel'), 'utf8')).toBe('keep');
    const target = resolve(directory, 'api-target'); mkdirSync(target); const alias = resolve(directory, 'api-alias'); symlinkSync(target, alias); expect((await verifyReleaseArtifacts(manifestPath, alias)).ok).toBe(false); expect(readdirSync(target)).toEqual([]);
  });
  test('binds both declaration compilers to the exact manifest versions before emitting', async () => {
    const value: any = structuredClone(manifest); value.tools.classic6 = '0.0.0'; const path = writeCandidate(value, 'compiler-version-mismatch'), work = resolve(directory, 'compiler-version-work');
    const result = await verifyReleaseArtifacts(path, work); expect(result.ok).toBe(false); expect(result.failures.some(failure => failure.includes('classic6 compiler version mismatch'))).toBe(true);
    expect(readdirSync(resolve(work, 'full-consumer')).some(name => name.startsWith('declarations-'))).toBe(false); publish(manifest);
  }, 30_000);
  test('matches both I14 diagnostics to their marked regions and expected message fragments', () => {
    const file = resolve(directory, 'marked-negative.cts'), source = "// diagnostic: wanted first\nconst first = 1;\n// diagnostic: wanted second\nconst second = 2;";
    const located = (firstMessage: string, firstLine = 2, secondMessage = 'wanted second', secondLine = 4) => `${file}(${firstLine},1): error TS2322: ${firstMessage}\n${file}(${secondLine},1): error TS2322: ${secondMessage}\n`;
    expect(matchesReleaseNegativeDiagnostics(source, file, located('wanted first'), directory)).toBe(true);
    expect(matchesReleaseNegativeDiagnostics(source, file, located('unrelated first', 2, 'unrelated second', 4), directory)).toBe(false);
    expect(matchesReleaseNegativeDiagnostics(source, file, located('wanted first', 1, 'wanted second', 2), directory)).toBe(false);
  });
  test('installs owned verified bytes and passes real Node/Bun, CJS/ESM, core-only, and declaration oracles', async () => {
    publish(manifest); const work = resolve(directory, 'real-work'); const result = await verifyReleaseArtifacts(manifestPath, work);
    expect(result).toEqual({ ok: true, failures: [] });
    for (const record of manifest.packages) expect(new Uint8Array(readFileSync(resolve(work, `archives/${record.name}-0.1.0.tgz`)))).toEqual(new Uint8Array(readFileSync(record.archive)));
    for (const emitter of ['classic6', 'native7']) for (const format of ['cts', 'mts']) { const declaration = resolve(work, `full-consumer/declarations-${emitter}-${format}/out/producer.d.${format}`); expect(existsSync(declaration)).toBe(true); expect(existsSync(resolve(work, `full-consumer/declarations-${emitter}-${format}/producer.${format}`))).toBe(false); }
  }, 180_000);
});

describe('final release audit', () => {
  const checkout = resolve(scratch, 'audit-checkout'), reports = resolve(checkout, 'docs/reports'), recordsDir = `/tmp/di-bag-release-candidate/audit-test-${process.pid}`;
  mkdirSync(reports, { recursive: true }); rmSync(recordsDir, { recursive: true, force: true }); mkdirSync(recordsDir);
  afterAll(() => rmSync(recordsDir, { recursive: true, force: true }));
  const manifest = resolve(scratch, 'audit-manifest.json'), publicEvidence = resolve(reports, '2026-09-08-release-candidate-evidence.json');
  writeFileSync(manifest, '{}\n'); writeFileSync(publicEvidence, '{}\n');
  const candidate = '1'.repeat(40), handoff = '2'.repeat(40);
  function argsAndRecords() {
    const manifestHash = hashFile(manifest), publicHash = hashFile(publicEvidence), inputs = [manifestHash, publicHash].sort((a, b) => a.path.localeCompare(b.path));
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
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); record.exitCode = 1; writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow(/successful|failed/); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); writeFileSync(record.stdout.path, 'wrong\n'); expect(() => createReleaseAudit(args)).toThrow(/mutated|hash mismatch/); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); record.inputs[0].sha256 = '0'.repeat(64); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow(/stale|hash mismatch/); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[0]!, 'utf8')); writeFileSync(record.stdout.path, `${candidate}\n`); record.stdout = hashFile(record.stdout.path); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow('HEAD'); }
    { const args = argsAndRecords(); const record = JSON.parse(readFileSync(args.records[1]!, 'utf8')); writeFileSync(record.stdout.path, 'src/index.ts\n'); record.stdout = hashFile(record.stdout.path); writeFileSync(args.records[1]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow('path diff'); }
  });
  test('rejects every invalid retained command field and fixed limit violation', () => {
    for (const mutate of [
      (record: any) => { record.startedAt = 'invalid'; }, (record: any) => { record.finishedAt = '2026-09-07T00:00:00.000Z'; },
      (record: any) => { record.elapsedMilliseconds = 9000; }, (record: any) => { record.peakObservedRssMiB = 4097; },
      (record: any) => { record.signal = 'SIGTERM'; }, (record: any) => { record.terminationReason = 'monitor'; },
      (record: any) => { record.inputs.push(structuredClone(record.inputs[0])); }, (record: any) => { record.inputs.reverse(); },
      (record: any) => { record.argv = ['npm', 'publish', 'x.tgz']; }, (record: any) => { record.cwd = '/not/canonical'; },
    ]) {
      const args = argsAndRecords(), record: any = JSON.parse(readFileSync(args.records[0]!, 'utf8')); mutate(record); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow();
    }
    { const args = argsAndRecords(), record: any = JSON.parse(readFileSync(args.records[0]!, 'utf8')); const extra = resolve(scratch, 'audit-extra-input'); writeFileSync(extra, 'extra'); record.inputs.push(hashFile(extra)); record.inputs.sort((a: any, b: any) => a.path.localeCompare(b.path)); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow('stale manifest/public'); }
    { const args = argsAndRecords(), record: any = JSON.parse(readFileSync(args.records[0]!, 'utf8')); writeFileSync(record.stderr.path, new Uint8Array(16 * 1024 * 1024 + 1)); record.stderr = hashFile(record.stderr.path); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow('output evidence exceeds limit'); }
    { const args = argsAndRecords(), record: any = JSON.parse(readFileSync(args.records[0]!, 'utf8')); const link = resolve(recordsDir, 'linked-head.stdout'); symlinkSync(record.stdout.path, link); record.stdout = hashFile(link); writeFileSync(args.records[0]!, JSON.stringify(record)); expect(() => createReleaseAudit(args)).toThrow(/descriptor|symlink/); rmSync(link, { force: true }); }
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
