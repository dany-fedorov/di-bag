import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import type { ReleaseCommandEvidence, ReleaseFileHash } from './run-release-command.ts';

export const PUBLIC_EVIDENCE_SUFFIX = 'docs/reports/2026-09-08-release-candidate-evidence.json';
export const APPROVED_HANDOFF_PATHS = Object.freeze([
  'docs/reports/2026-09-08-final-integration-release.md',
  'docs/reports/2026-09-08-release-candidate-evidence.json',
  'docs/superpowers/plans/2026-09-06-enterprise-di-program.md',
]);
export type ReleaseAuditArgs = Readonly<{ records: readonly string[]; manifest: string; publicEvidence: string; candidateCommit: string; handoffCommit: string; out: string }>;
const oid = /^[0-9a-f]{40}$/;

function absolute(path: string, label: string): string { if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`${label} must be absolute and canonical`); return path; }
export function parseReleaseAuditArgs(argv: readonly string[]): ReleaseAuditArgs {
  const values = new Map<string, string>(); const records: string[] = [];
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index], value = argv[index + 1];
    if (!['--record', '--manifest', '--public-evidence', '--candidate-commit', '--handoff-commit', '--out'].includes(option ?? '')) throw new Error(`unsupported option: ${option}`);
    if (!value) throw new Error(`missing value for ${option}`);
    if (option === '--record') records.push(absolute(value, 'record')); else if (values.has(option!)) throw new Error(`duplicate option: ${option}`); else values.set(option!, value);
  }
  const manifest = absolute(values.get('--manifest') ?? '', 'manifest');
  const publicEvidence = absolute(values.get('--public-evidence') ?? '', 'public evidence');
  if (!publicEvidence.endsWith(`/${PUBLIC_EVIDENCE_SUFFIX}`)) throw new Error('public evidence path is not fixed sanitized evidence');
  const out = absolute(values.get('--out') ?? '', 'output');
  if (out !== '/tmp/di-bag-release-candidate/final-audit.json') throw new Error('output must be /tmp/di-bag-release-candidate/final-audit.json');
  const candidateCommit = values.get('--candidate-commit') ?? '', handoffCommit = values.get('--handoff-commit') ?? '';
  if (!oid.test(candidateCommit) || !oid.test(handoffCommit)) throw new Error('candidate and handoff commits must be full lowercase Git OIDs');
  if (records.length !== 5 || new Set(records).size !== 5) throw new Error('exactly five unique final records are required');
  return Object.freeze({ records: Object.freeze(records), manifest, publicEvidence, candidateCommit, handoffCommit, out });
}
function readOnce(path: string): Uint8Array {
  if (realpathSync(path) !== path) throw new Error(`evidence path uses a symlink: ${path}`);
  const fd = openSync(path, 'r'); try { if (realpathSync(`/proc/self/fd/${fd}`) !== path) throw new Error('evidence descriptor escaped expected path'); const stat = fstatSync(fd); if (!stat.isFile()) throw new Error('evidence must be a regular file'); const bytes = new Uint8Array(stat.size); let offset = 0; while (offset < bytes.length) { const n = readSync(fd, bytes, offset, bytes.length - offset, offset); if (!n) throw new Error('short evidence read'); offset += n; } const after = fstatSync(fd); if (stat.dev !== after.dev || stat.ino !== after.ino || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs) throw new Error('evidence changed while reading'); return bytes; } finally { closeSync(fd); }
}
function hash(path: string, bytes = readOnce(path)): ReleaseFileHash { return Object.freeze({ path, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }); }
function equalHash(actual: ReleaseFileHash, expected: ReleaseFileHash): boolean { return actual.path === expected.path && actual.bytes === expected.bytes && actual.sha256 === expected.sha256; }
function validRecord(record: ReleaseCommandEvidence): void {
  if (record.exitCode !== 0 || record.signal !== null || record.terminationReason !== null) throw new Error('final command record is failed');
  if (!Array.isArray(record.argv) || typeof record.cwd !== 'string') throw new Error('malformed final command record');
  for (const log of [record.stdout, record.stderr]) if (!equalHash(log, hash(log.path))) throw new Error('mutated final command log');
}
function stdout(record: ReleaseCommandEvidence): string { return Buffer.from(readOnce(record.stdout.path)).toString('utf8').trimEnd(); }
export function createReleaseAudit(args: ReleaseAuditArgs): unknown {
  const manifestHash = hash(args.manifest), publicHash = hash(args.publicEvidence);
  const parsed = args.records.map(path => {
    const bytes = readOnce(path); let record: ReleaseCommandEvidence;
    try { record = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { throw new Error('invalid final command record JSON'); }
    validRecord(record);
    if (record.inputs.length !== 2 || !record.inputs.some(input => equalHash(input, manifestHash)) || !record.inputs.some(input => equalHash(input, publicHash))) throw new Error('final command record has stale manifest/public input hashes');
    return { path, record, recordHash: hash(path, bytes) };
  });
  const checkout = resolve(args.publicEvidence, '../../..');
  const byArgv = (argv: readonly string[]) => parsed.filter(item => JSON.stringify(item.record.argv) === JSON.stringify(argv) && item.record.cwd === checkout);
  const roles = {
    head: byArgv(['git', 'rev-parse', 'HEAD']),
    diff: byArgv(['git', 'diff', '--name-only', `${args.candidateCommit}..${args.handoffCommit}`]),
    status: byArgv(['git', 'status', '--short']),
    tests: byArgv(['bun', 'test', 'tests/release-artifacts.test.ts']),
    verifier: byArgv(['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/verify-release-artifacts.ts', '--manifest', args.manifest, '--work-dir', '/tmp/di-bag-release-candidate/final-work']),
  };
  for (const [role, matches] of Object.entries(roles)) if (matches.length !== 1) throw new Error(`missing or duplicate final ${role} record`);
  if (stdout(roles.head[0]!.record) !== args.handoffCommit) throw new Error('final HEAD does not equal handoff commit');
  if (stdout(roles.diff[0]!.record).split('\n').filter(Boolean).sort().join('\n') !== [...APPROVED_HANDOFF_PATHS].sort().join('\n')) throw new Error('candidate-to-handoff path diff is not approved');
  const statusLines = stdout(roles.status[0]!.record).split('\n').filter(Boolean);
  if (statusLines.length !== 1 || !/^\?\? docs\/reports\/2026-09-08-execution-handoff\.md$/.test(statusLines[0]!)) throw new Error('final status is not the preserved execution handoff only');
  return Object.freeze({ schemaVersion: 1, candidateCommit: args.candidateCommit, handoffCommit: args.handoffCommit, manifest: manifestHash, publicEvidence: publicHash,
    commands: Object.freeze(Object.entries(roles).map(([role, matches]) => Object.freeze({ role, record: matches[0]!.recordHash })).sort((a, b) => a.role.localeCompare(b.role))) });
}
function atomicWrite(path: string, value: string): void { const temp = `${path}.tmp-${process.pid}`; try { writeFileSync(temp, value, { flag: 'wx' }); renameSync(temp, path); } finally { rmSync(temp, { force: true }); } }
if (basename(process.argv[1] ?? '') === 'create-release-audit.ts') { const args = parseReleaseAuditArgs(process.argv.slice(2)); atomicWrite(args.out, `${JSON.stringify(createReleaseAudit(args), null, 2)}\n`); }
