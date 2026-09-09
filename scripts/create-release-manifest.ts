import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, writeFileSync, lstatSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { inspectNpmArchive } from './release-archive.ts';
import { APPROVED_HANDOFF_PATHS, PUBLIC_EVIDENCE_SUFFIX } from './create-release-audit.ts';
import { collectReviewedNativeGaps, type NativeGapFingerprint } from './release-native-inventory.ts';
import { validateReleaseCommandEvidence, type ReleaseCommandEvidence } from './run-release-command.ts';

export type { NativeGapFingerprint, ReleaseCommandEvidence };
export type ReleasePackageRecord = Readonly<{ name: 'di-bag'; version: string; archive: string; checkout: Readonly<{ path: string; branch: string; candidateSourceCommit: string; status: string }>; pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>; commands: readonly ReleaseCommandEvidence[]; integrity: string; sha256: string; sha512: string; bytes: number; files: readonly string[]; packageMetadata: Readonly<{ name: string; version: string; main?: string; types?: string; files: readonly string[]; exports: unknown; dependencies: Readonly<Record<string, string>>; peerDependencies: Readonly<Record<string, string>>; optionalDependencies: Readonly<Record<string, string>>; bundledDependencies: readonly string[] }> }>;
export type ReleaseEvidenceInput = Readonly<{ schemaVersion: 1; generatedAt: string; artifactDirectory: '/tmp/di-bag-release-candidate'; tools: Readonly<{ node: string; npm: string; bun: string; classic6: string; native7: string }>; nativeDiagnostics: Readonly<{ reviewedAt: string; reviewedGaps: readonly NativeGapFingerprint[]; freshGaps: readonly NativeGapFingerprint[] }>; handoff: Readonly<{ candidateSourceCommit: string; handoffCommit: string; changedPaths: readonly string[] }>; packages: readonly Readonly<{ name: 'di-bag'; version: string; archive: string; checkout: Readonly<{ path: string; branch: string; candidateSourceCommit: string; status: string }>; pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>; commands: readonly ReleaseCommandEvidence[] }> [] }>;
export type ReleaseManifest = Readonly<{ schemaVersion: 1; artifactDirectory: string; generatedAt: string; tools: ReleaseEvidenceInput['tools']; nativeDiagnostics: ReleaseEvidenceInput['nativeDiagnostics']; handoff: ReleaseEvidenceInput['handoff']; packages: readonly ReleasePackageRecord[] }>;
export type ManifestArgs = Readonly<{ input: string; out: string; publicOut?: string }>;
const PACKAGE_NAMES = ['di-bag'] as const;
const FULL_OID = /^[0-9a-f]{40}$/;

function absoluteCanonical(path: string, label: string): string { if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`${label} must be absolute`); return path; }
export function parseManifestArgs(argv: readonly string[], cwd = process.cwd()): ManifestArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index], value = argv[index + 1];
    if (!['--input', '--out', '--public-out'].includes(option ?? '')) throw new Error(`unsupported option: ${option}`);
    if (!value || values.has(option!)) throw new Error(`missing or duplicate value for ${option}`); values.set(option!, value);
  }
  const input = absoluteCanonical(values.get('--input') ?? '', 'evidence input');
  const out = absoluteCanonical(values.get('--out') ?? '', 'manifest output');
  const publicValue = values.get('--public-out');
  if (publicValue !== undefined && publicValue !== PUBLIC_EVIDENCE_SUFFIX) throw new Error(`public output must be ${PUBLIC_EVIDENCE_SUFFIX}`);
  const publicOut = publicValue === undefined ? undefined : resolve(cwd, publicValue);
  if (publicOut !== undefined) {
    const parent = realpathSync(dirname(publicOut));
    if (parent !== dirname(publicOut) || !publicOut.startsWith(`${realpathSync(cwd)}/`)) throw new Error('public output escapes checkout or uses a symlink');
    try { if (lstatSync(publicOut).isSymbolicLink()) throw new Error('public output must not be a symlink'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return Object.freeze({ input, out, ...(publicOut === undefined ? {} : { publicOut }) });
}
function isContained(parent: string, child: string): boolean { const rel = relative(parent, child); return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel); }
function readRegularOnce(path: string, container?: string): Uint8Array {
  if (resolve(path) !== path) throw new Error(`noncanonical evidence path: ${path}`);
  if (container && !isContained(container, path)) throw new Error(`evidence path is outside artifact directory: ${path}`);
  if (realpathSync(path) !== path) throw new Error(`evidence path escapes through symlink: ${path}`);
  const fd = openSync(path, 'r');
  try { const openedPath = realpathSync(`/proc/self/fd/${fd}`); if (openedPath !== path || container && !isContained(container, openedPath)) throw new Error(`evidence descriptor escaped expected path: ${path}`); const before = fstatSync(fd); if (!before.isFile()) throw new Error(`not a regular evidence file: ${path}`); const bytes = new Uint8Array(before.size); let offset = 0; while (offset < bytes.length) { const count = readSync(fd, bytes, offset, bytes.length - offset, offset); if (!count) throw new Error(`short evidence read: ${path}`); offset += count; } const after = fstatSync(fd); if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`evidence file replaced while reading: ${path}`); return bytes; } finally { closeSync(fd); }
}
const digest = (algorithm: string, bytes: Uint8Array, encoding: 'hex' | 'base64' = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
function exactIso(value: unknown, label: string): asserts value is string { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp`); }
function normalizeMap(value: unknown, label: string): Readonly<Record<string, string>> { if (value === undefined) return Object.freeze({}); if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => typeof item !== 'string')) throw new Error(`invalid ${label}`); return Object.freeze(Object.fromEntries(Object.entries(value as Record<string, string>).sort(([a], [b]) => a.localeCompare(b)))); }
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])); return value; }
function commandEvidence(value: ReleaseCommandEvidence, artifact: string): ReleaseCommandEvidence {
  return validateReleaseCommandEvidence(value, artifact);
}
function gapKey(gap: NativeGapFingerprint): string { return `${gap.fixture}\0${gap.markerLine}\0${gap.id}\0${gap.markerOccurrence}\0${gap.fingerprint}`; }
function validateGaps(reviewed: readonly NativeGapFingerprint[], fresh: readonly NativeGapFingerprint[]): void {
  for (const [label, gaps] of [['reviewed', reviewed], ['fresh', fresh]] as const) {
    const occurrence = new Set<string>();
    for (const gap of gaps) {
      const base = { id: gap.id, fixture: gap.fixture, markerLine: gap.markerLine, markerOccurrence: gap.markerOccurrence, code: gap.code, normalizedMessage: gap.normalizedMessage.replace(/\r\n?/g, '\n') };
      if (!gap.id || gap.fixture.startsWith('/') || gap.fixture.includes('\\') || gap.fixture.split('/').some(part => !part || part === '.' || part === '..') || !Number.isInteger(gap.markerLine) || gap.markerLine < 1 || !Number.isInteger(gap.markerOccurrence) || gap.markerOccurrence < 1 || gap.code !== 2769 || gap.normalizedMessage !== base.normalizedMessage || gap.fingerprint !== digest('sha256', new TextEncoder().encode(JSON.stringify(base)))) throw new Error(`changed ${label} native fingerprint`);
      const position = `${gap.fixture}\0${gap.markerLine}\0${gap.id}\0${gap.markerOccurrence}`; if (occurrence.has(position)) throw new Error(`duplicate ${label} native occurrence`); occurrence.add(position);
    }
  }
  const pool = new Map<string, number>(); for (const gap of reviewed) pool.set(gapKey(gap), (pool.get(gapKey(gap)) ?? 0) + 1);
  for (const gap of fresh) { const key = gapKey(gap), count = pool.get(key) ?? 0; if (!count) throw new Error('fresh native gaps are not a subset of reviewed gaps'); pool.set(key, count - 1); }
}
function packResult(value: unknown, label: string): any {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== 'object') throw new Error(`${label} pack JSON must contain exactly one result`); return value[0];
}
function packageRecord(input: ReleaseEvidenceInput['packages'][number], artifact: string): ReleasePackageRecord {
  if (!PACKAGE_NAMES.includes(input.name)) throw new Error(`unsupported package: ${input.name}`);
  if (!input.version || !input.checkout?.branch || !FULL_OID.test(input.checkout.candidateSourceCommit) || typeof input.checkout.status !== 'string') throw new Error(`missing checkout facts for ${input.name}`);
  if (realpathSync(input.checkout.path) !== input.checkout.path) throw new Error(`checkout path is not canonical: ${input.name}`);
  exactIso(input.pack?.packedAt, 'packedAt');
  if (!Array.isArray(input.commands) || !input.commands.length) throw new Error(`missing command evidence for ${input.name}`);
  const commands = input.commands.map(command => commandEvidence(command, artifact));
  const archiveBytes = readRegularOnce(input.archive, artifact), archive = inspectNpmArchive(archiveBytes);
  let metadata: any; try { metadata = JSON.parse(Buffer.from(archive.packageJson).toString('utf8')); } catch { throw new Error(`invalid package metadata for ${input.name}`); }
  if (metadata.name !== input.name || metadata.version !== input.version) throw new Error(`recorded version differs from package/package.json for ${input.name}`);
  const files = archive.entries.map(entry => entry.path.slice('package/'.length));
  const expected = { id: `${input.name}@${input.version}`, name: input.name, version: input.version, filename: `${input.name}-${input.version}.tgz`, size: archiveBytes.byteLength, unpackedSize: archive.unpackedBytes, shasum: digest('sha1', archiveBytes), integrity: `sha512-${digest('sha512', archiveBytes, 'base64')}`, files };
  for (const [label, raw] of [['dry-run', input.pack.dryRunJson], ['actual', input.pack.packJson]] as const) {
    const result = packResult(raw, label);
    for (const field of ['id', 'name', 'version', 'filename', 'size', 'unpackedSize', 'shasum', 'integrity'] as const) if (result[field] !== expected[field]) throw new Error(`${label} pack ${field} mismatch for ${input.name}`);
    if (result.entryCount !== files.length || !Array.isArray(result.files) || result.files.length !== files.length || new Set(result.files.map((file: any) => file?.path)).size !== files.length) throw new Error(`${label} pack file count mismatch for ${input.name}`);
    const actualFiles = result.files.map((file: any) => ({ path: file?.path, size: file?.size, mode: file?.mode })).sort((a: any, b: any) => String(a.path).localeCompare(String(b.path)));
    const expectedFiles = archive.entries.map(entry => ({ path: entry.path.slice('package/'.length), size: entry.bytes, mode: entry.mode })).sort((a, b) => a.path.localeCompare(b.path));
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error(`${label} pack file list mismatch for ${input.name}`);
    if (!Array.isArray(result.bundled) || result.bundled.length !== 0) throw new Error(`${label} pack bundled list mismatch for ${input.name}`);
  }
  const packageMetadata = Object.freeze({ name: metadata.name, version: metadata.version,
    ...(typeof metadata.main === 'string' ? { main: metadata.main } : {}), ...(typeof metadata.types === 'string' ? { types: metadata.types } : {}),
    files: Object.freeze(Array.isArray(metadata.files) ? [...metadata.files].sort() : []), exports: stable(metadata.exports ?? null), dependencies: normalizeMap(metadata.dependencies, 'dependencies'),
    peerDependencies: normalizeMap(metadata.peerDependencies, 'peerDependencies'), optionalDependencies: normalizeMap(metadata.optionalDependencies, 'optionalDependencies'),
    bundledDependencies: Object.freeze(Array.isArray(metadata.bundledDependencies) ? [...metadata.bundledDependencies].sort() : []) });
  return Object.freeze({ ...input, pack: Object.freeze({ dryRunJson: stable(input.pack.dryRunJson), packJson: stable(input.pack.packJson), packedAt: input.pack.packedAt }), commands: Object.freeze(commands),
    integrity: expected.integrity, sha256: digest('sha256', archiveBytes), sha512: digest('sha512', archiveBytes), bytes: archiveBytes.byteLength, files: Object.freeze([...files].sort()), packageMetadata });
}
export function createReleaseManifest(input: ReleaseEvidenceInput): ReleaseManifest {
  if (input?.schemaVersion !== 1 || input.artifactDirectory !== '/tmp/di-bag-release-candidate') throw new Error('unsupported release evidence schema or artifact directory');
  const artifact = realpathSync(input.artifactDirectory);
  exactIso(input.generatedAt, 'generatedAt'); exactIso(input.nativeDiagnostics?.reviewedAt, 'reviewedAt');
  if (!input.tools || !['node', 'npm', 'bun', 'classic6', 'native7'].every(name => typeof input.tools[name as keyof typeof input.tools] === 'string' && input.tools[name as keyof typeof input.tools] && !input.tools[name as keyof typeof input.tools].includes('/') && !input.tools[name as keyof typeof input.tools].includes('\\')) || Object.keys(input.tools).length !== 5) throw new Error('missing or invalid tool evidence');
  if (!FULL_OID.test(input.handoff?.candidateSourceCommit ?? '') || !FULL_OID.test(input.handoff?.handoffCommit ?? '')) throw new Error('invalid handoff commits');
  if (!Array.isArray(input.handoff.changedPaths) || new Set(input.handoff.changedPaths).size !== input.handoff.changedPaths.length || input.handoff.changedPaths.some(path => !APPROVED_HANDOFF_PATHS.includes(path))) throw new Error('handoff changed paths are not approved');
  validateGaps(input.nativeDiagnostics.reviewedGaps, input.nativeDiagnostics.freshGaps);
  if (!Array.isArray(input.packages) || input.packages.length !== 1 || input.packages[0]?.name !== 'di-bag') throw new Error('exactly one di-bag package record is required');
  const packages = input.packages.map(item => packageRecord(item, artifact)).sort((a, b) => a.name.localeCompare(b.name));
  const diBag = packages.find(item => item.name === 'di-bag')!;
  const authoritativeReviewed = collectReviewedNativeGaps(resolve(diBag.checkout.path, 'tests/types'));
  const compareGaps = (gaps: readonly NativeGapFingerprint[]) => JSON.stringify([...gaps].sort((a, b) => a.fixture.localeCompare(b.fixture) || a.markerLine - b.markerLine || a.id.localeCompare(b.id)));
  if (compareGaps(input.nativeDiagnostics.reviewedGaps) !== compareGaps(authoritativeReviewed)) throw new Error('reviewed native gaps differ from frozen source authority');
  const retainedLogs = packages.flatMap(item => item.commands.flatMap(command => [command.stdout.path, command.stderr.path]));
  if (new Set(retainedLogs).size !== retainedLogs.length) throw new Error('duplicate retained command log path');
  const sortGaps = (gaps: readonly NativeGapFingerprint[]) => Object.freeze([...gaps].sort((a, b) => a.fixture.localeCompare(b.fixture) || a.markerLine - b.markerLine || a.id.localeCompare(b.id)));
  return Object.freeze({ schemaVersion: 1, artifactDirectory: artifact, generatedAt: input.generatedAt, tools: Object.freeze({ ...input.tools }),
    nativeDiagnostics: Object.freeze({ reviewedAt: input.nativeDiagnostics.reviewedAt, reviewedGaps: sortGaps(input.nativeDiagnostics.reviewedGaps), freshGaps: sortGaps(input.nativeDiagnostics.freshGaps) }),
    handoff: Object.freeze({ candidateSourceCommit: input.handoff.candidateSourceCommit, handoffCommit: input.handoff.handoffCommit, changedPaths: Object.freeze([...input.handoff.changedPaths].sort()) }), packages: Object.freeze(packages) });
}
function sanitizeCommand(command: ReleaseCommandEvidence, roots: readonly [string, string][]): unknown {
  const clean = (value: string) => {
    let cleaned = value;
    for (const [root, token] of roots) cleaned = cleaned.split(root).join(token);
    if (containsAbsolutePath(cleaned)) throw new Error('public evidence contains an unsanitized absolute path');
    return cleaned;
  };
  return { argv: command.argv.map(clean), cwd: clean(command.cwd), startedAt: command.startedAt, finishedAt: command.finishedAt, elapsedMilliseconds: command.elapsedMilliseconds, exitCode: command.exitCode, signal: command.signal, terminationReason: command.terminationReason, peakObservedRssMiB: command.peakObservedRssMiB,
    inputs: command.inputs.map(input => ({ path: clean(input.path), bytes: input.bytes, sha256: input.sha256 })), stdout: { bytes: command.stdout.bytes, sha256: command.stdout.sha256 }, stderr: { bytes: command.stderr.bytes, sha256: command.stderr.sha256 } };
}
function containsAbsolutePath(value: string): boolean { return value.includes('file:/') || /(^|[^A-Za-z0-9._<>\/~:-])\/(?!\/)/.test(value) || /^\//.test(value); }
function assertPublicPathSafe(value: unknown, field?: string): void {
  if (typeof value === 'string') {
    if (field === 'integrity') {
      if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(value)) throw new Error('public evidence contains malformed integrity');
      return;
    }
    if (containsAbsolutePath(value)) throw new Error('public evidence contains an unsanitized absolute path');
    return;
  }
  if (Array.isArray(value)) { for (const item of value) assertPublicPathSafe(item); return; }
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { assertPublicPathSafe(key); assertPublicPathSafe(item, key); }
}
export function createPublicReleaseEvidence(manifest: ReleaseManifest): unknown {
  const roots: [string, string][] = [[manifest.artifactDirectory, '<artifact>'], ...manifest.packages.map(item => [item.checkout.path, `<checkout:${item.name}>`] as [string, string])]; roots.sort((a, b) => b[0].length - a[0].length);
  const projection = stable({ schemaVersion: 1, generatedAt: manifest.generatedAt, tools: manifest.tools, nativeDiagnostics: manifest.nativeDiagnostics,
    handoff: { candidateSourceCommit: manifest.handoff.candidateSourceCommit, allowedHandoffPaths: APPROVED_HANDOFF_PATHS },
    packages: manifest.packages.map(item => ({ name: item.name, version: item.version, checkout: { branch: item.checkout.branch, candidateSourceCommit: item.checkout.candidateSourceCommit, status: item.checkout.status },
      packedAt: item.pack.packedAt, commands: item.commands.map(command => sanitizeCommand(command, roots)), integrity: item.integrity, sha256: item.sha256, sha512: item.sha512, bytes: item.bytes, files: item.files, packageMetadata: item.packageMetadata })) });
  assertPublicPathSafe(projection);
  return projection;
}
function atomicWrite(path: string, bytes: Uint8Array): void { const temp = `${path}.tmp-${process.pid}`; try { writeFileSync(temp, bytes, { flag: 'wx' }); renameSync(temp, path); } finally { rmSync(temp, { force: true }); } }
export function serializeStable(value: unknown): string { return `${JSON.stringify(stable(value), null, 2)}\n`; }
if (basename(process.argv[1] ?? '') === 'create-release-manifest.ts') {
  const args = parseManifestArgs(process.argv.slice(2));
  const bytes = readRegularOnce(args.input); let input: ReleaseEvidenceInput; try { input = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { throw new Error('invalid release evidence input JSON'); }
  const manifest = createReleaseManifest(input); atomicWrite(args.out, new TextEncoder().encode(serializeStable(manifest)));
  if (args.publicOut) atomicWrite(args.publicOut, new TextEncoder().encode(serializeStable(createPublicReleaseEvidence(manifest))));
}
