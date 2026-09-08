import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { supervise, type ProcessLimits } from './native-process.ts';

export const RELEASE_COMMAND_LIMITS: Readonly<ProcessLimits> = Object.freeze({ timeoutMilliseconds: 900_000, maxRssMiB: 4096, maxOutputBytes: 16 * 1024 * 1024, sampleMilliseconds: 20 });
export type ReleaseFileHash = Readonly<{ path: string; bytes: number; sha256: string }>;
export type ReleaseLogEvidence = ReleaseFileHash;
export type ReleaseCommandEvidence = Readonly<{ argv: readonly string[]; cwd: string; startedAt: string; finishedAt: string; elapsedMilliseconds: number; exitCode: number | null; signal: string | null; terminationReason: 'timeout' | 'memory' | 'output' | 'monitor' | 'spawn' | null; peakObservedRssMiB: number; inputs: readonly ReleaseFileHash[]; stdout: ReleaseLogEvidence; stderr: ReleaseLogEvidence }>;
export type ReleaseCommandArgs = Readonly<{ artifactDir: string; record: string; cwd: string; inputs: readonly string[]; argv: readonly string[] }>;

function canonicalExisting(path: string, label: string): string {
  if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`${label} must be an absolute canonical path`);
  const canonical = realpathSync(path);
  if (canonical !== path) throw new Error(`${label} must not contain symlinks`);
  return canonical;
}
function contained(parent: string, child: string): boolean { const rel = relative(parent, child); return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel); }
function outputPath(artifactDir: string, path: string, label: string): string {
  if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`${label} must be an absolute canonical path`);
  const parent = realpathSync(dirname(path));
  if (!contained(artifactDir, path) || !contained(artifactDir, parent) && parent !== artifactDir) throw new Error(`${label} must be contained by artifact directory`);
  try { if (lstatSync(path).isSymbolicLink()) throw new Error(`${label} must not be a symlink`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return path;
}
export function assertSafeReleaseArgv(argv: readonly string[]): void {
  if (!argv.length || !argv[0] || argv[0].includes('\0') || /\s/.test(argv[0])) throw new Error('command executable must be one argv token');
  const executable = basename(argv[0]).toLowerCase();
  if (['sh', 'bash', 'dash', 'zsh', 'fish', 'cmd', 'cmd.exe', 'powershell', 'pwsh'].includes(executable)) throw new Error('shell commands are forbidden');
  const lower = argv.map(value => value.toLowerCase());
  if (argv.some(value => value.includes('\0') || ['&&', '||', ';', '|', '>', '>>', '<'].includes(value))) throw new Error('shell operators are forbidden');
  if (lower.some(value => value.includes('registry.npmjs.org') || value.includes('_authtoken') || value === '--registry')) throw new Error('registry and credential operations are forbidden');
  if (executable === 'npm' && lower.slice(1).some(value => ['view', 'whoami', 'login', 'publish', 'dist-tag', 'token', 'config', 'adduser', 'logout'].includes(value))) throw new Error('online or publication npm command is forbidden');
  if (executable === 'git' && lower.slice(1).some(value => ['push', 'tag', 'fetch', 'pull', 'clone', 'remote'].includes(value))) throw new Error('remote or mutating Git command is forbidden');
}
export function parseReleaseCommandArgs(argv: readonly string[]): ReleaseCommandArgs {
  const divider = argv.indexOf('--');
  if (divider < 0) throw new Error('command argv must follow --');
  const options = argv.slice(0, divider), command = argv.slice(divider + 1);
  const values = new Map<string, string>(); const inputs: string[] = [];
  for (let i = 0; i < options.length; i += 2) {
    const option = options[i], value = options[i + 1];
    if (!['--artifact-dir', '--record', '--cwd', '--input'].includes(option ?? '')) throw new Error(`unsupported option: ${option}`);
    if (!value) throw new Error(`missing value for ${option}`);
    if (option === '--input') inputs.push(value); else if (values.has(option!)) throw new Error(`duplicate option: ${option}`); else values.set(option!, value);
  }
  const artifactDir = canonicalExisting(values.get('--artifact-dir') ?? '', 'artifact directory');
  const cwd = canonicalExisting(values.get('--cwd') ?? '', 'cwd');
  const record = outputPath(artifactDir, values.get('--record') ?? '', 'record');
  const canonicalInputs = inputs.map(path => canonicalExisting(path, 'input')).sort();
  if (new Set(canonicalInputs).size !== canonicalInputs.length) throw new Error('duplicate input path');
  assertSafeReleaseArgv(command);
  return Object.freeze({ artifactDir, record, cwd, inputs: Object.freeze(canonicalInputs), argv: Object.freeze([...command]) });
}
function readRegularOnce(path: string): Uint8Array {
  const descriptor = openSync(path, 'r');
  try {
    if (realpathSync(`/proc/self/fd/${descriptor}`) !== path) throw new Error(`file descriptor escaped expected path: ${path}`);
    const before = fstatSync(descriptor); if (!before.isFile()) throw new Error(`not a regular file: ${path}`);
    const bytes = new Uint8Array(before.size); let offset = 0;
    while (offset < bytes.length) { const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset); if (!count) throw new Error(`short read: ${path}`); offset += count; }
    const after = fstatSync(descriptor); if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`file changed while reading: ${path}`);
    return bytes;
  } finally { closeSync(descriptor); }
}
function fileHash(path: string): ReleaseFileHash { const bytes = readRegularOnce(path); return Object.freeze({ path, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }); }
function atomicWrite(path: string, bytes: Uint8Array): void { const temp = `${path}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`; try { writeFileSync(temp, bytes, { flag: 'wx' }); renameSync(temp, path); } finally { rmSync(temp, { force: true }); } }
function bestEffortRemoveFile(path: string): void { try { const stat = lstatSync(path); if (stat.isFile() || stat.isSymbolicLink()) rmSync(path, { force: true }); } catch {} }

export type ReleaseSupervisor = typeof supervise;
export async function runReleaseCommand(args: ReleaseCommandArgs, limits: ProcessLimits = RELEASE_COMMAND_LIMITS, supervisor: ReleaseSupervisor = supervise): Promise<ReleaseCommandEvidence> {
  assertSafeReleaseArgv(args.argv);
  const inputs = args.inputs.map(fileHash).sort((a, b) => a.path.localeCompare(b.path));
  const stdoutPath = `${args.record}.stdout`, stderrPath = `${args.record}.stderr`;
  const startedAt = new Date().toISOString();
  const result = await supervisor(args.argv[0]!, args.argv.slice(1), args.cwd, limits);
  const finishedAt = new Date().toISOString();
  if (result.status !== 0 || result.signal !== null || result.terminationReason !== undefined)
    throw new Error(`release command failed: ${result.terminationReason ?? result.signal ?? `exit ${result.status}`}`);
  try {
    atomicWrite(stdoutPath, new TextEncoder().encode(result.stdout));
    atomicWrite(stderrPath, new TextEncoder().encode(result.stderr));
    const record: ReleaseCommandEvidence = Object.freeze({ argv: Object.freeze([...args.argv]), cwd: args.cwd, startedAt, finishedAt,
      elapsedMilliseconds: result.milliseconds, exitCode: 0, signal: null, terminationReason: null, peakObservedRssMiB: result.peakObservedRssMiB,
      inputs: Object.freeze(inputs), stdout: fileHash(stdoutPath), stderr: fileHash(stderrPath) });
    atomicWrite(args.record, new TextEncoder().encode(`${JSON.stringify(record, null, 2)}\n`));
    return record;
  } catch (error) {
    bestEffortRemoveFile(args.record); bestEffortRemoveFile(stdoutPath); bestEffortRemoveFile(stderrPath); throw error;
  }
}
if (basename(process.argv[1] ?? '') === 'run-release-command.ts') runReleaseCommand(parseReleaseCommandArgs(process.argv.slice(2))).catch(error => { console.error(error); process.exitCode = 1; });
