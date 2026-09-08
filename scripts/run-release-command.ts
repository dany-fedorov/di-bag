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
  if (!argv.length || argv.some(value => typeof value !== 'string' || value.includes('\0')) || !argv[0] || /\s/.test(argv[0])) throw new Error('command executable must be one argv token');
  const executable = basename(argv[0]).toLowerCase();
  if (['sh', 'bash', 'dash', 'zsh', 'fish', 'cmd', 'cmd.exe', 'powershell', 'pwsh'].includes(executable)) throw new Error('shell commands are forbidden');
  if (['env', 'npx', 'bunx', 'corepack', 'xargs', 'nohup', 'sudo', 'command'].includes(executable)) throw new Error('command wrappers are forbidden');
  const lower = argv.map(value => value.toLowerCase());
  if (argv.some(value => value.includes('\0') || ['&&', '||', ';', '|', '>', '>>', '<'].includes(value))) throw new Error('shell operators are forbidden');
  if (lower.some(value => value.includes('registry.npmjs.org') || value.includes('_authtoken') || value === '--registry')) throw new Error('registry and credential operations are forbidden');
  if (executable === 'npm' && lower.slice(1).some(value => ['view', 'whoami', 'login', 'publish', 'dist-tag', 'token', 'config', 'adduser', 'logout'].includes(value))) throw new Error('online or publication npm command is forbidden');
  if (executable === 'git' && lower.slice(1).some(value => ['push', 'tag', 'fetch', 'pull', 'clone', 'remote'].includes(value))) throw new Error('remote or mutating Git command is forbidden');
  for (let index = 0; index < lower.length; index++) {
    const token = basename(lower[index]!);
    if (token === 'npm' && lower.slice(index + 1).some(value => ['view', 'whoami', 'login', 'publish', 'dist-tag', 'token', 'config', 'adduser', 'logout'].includes(value))) throw new Error('wrapped online or publication npm command is forbidden');
    if (token === 'git' && lower.slice(index + 1).some(value => ['push', 'tag', 'fetch', 'pull', 'clone', 'remote'].includes(value))) throw new Error('wrapped remote or mutating Git command is forbidden');
  }
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
function readRegularOnce(path: string, container?: string): Uint8Array {
  if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`file path must be absolute and canonical: ${path}`);
  if (container && !contained(container, path)) throw new Error(`file path is outside artifact directory: ${path}`);
  const descriptor = openSync(path, 'r');
  try {
    const opened = realpathSync(`/proc/self/fd/${descriptor}`);
    if (opened !== path || container && !contained(container, opened)) throw new Error(`file descriptor escaped expected path: ${path}`);
    const before = fstatSync(descriptor); if (!before.isFile()) throw new Error(`not a regular file: ${path}`);
    const bytes = new Uint8Array(before.size); let offset = 0;
    while (offset < bytes.length) { const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset); if (!count) throw new Error(`short read: ${path}`); offset += count; }
    const after = fstatSync(descriptor); if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`file changed while reading: ${path}`);
    return bytes;
  } finally { closeSync(descriptor); }
}
function fileHash(path: string, container?: string): ReleaseFileHash { const bytes = readRegularOnce(path, container); return Object.freeze({ path, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }); }
function equalHash(left: ReleaseFileHash, right: ReleaseFileHash): boolean { return left.path === right.path && left.bytes === right.bytes && left.sha256 === right.sha256; }
function exactIso(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
export function validateReleaseCommandEvidence(value: ReleaseCommandEvidence, artifactDir: string): ReleaseCommandEvidence {
  const artifact = canonicalExisting(artifactDir, 'artifact directory');
  assertSafeReleaseArgv(value.argv);
  if (!isAbsolute(value.cwd) || resolve(value.cwd) !== value.cwd || realpathSync(value.cwd) !== value.cwd) throw new Error('command cwd is not canonical');
  if (!exactIso(value.startedAt) || !exactIso(value.finishedAt)) throw new Error('command timestamps are invalid');
  const wall = Date.parse(value.finishedAt) - Date.parse(value.startedAt);
  if (wall < 0 || !Number.isInteger(value.elapsedMilliseconds) || value.elapsedMilliseconds < 0 || value.elapsedMilliseconds > RELEASE_COMMAND_LIMITS.timeoutMilliseconds || Math.abs(wall - value.elapsedMilliseconds) > 1000) throw new Error('command elapsed time is inconsistent');
  if (value.exitCode !== 0 || value.signal !== null || value.terminationReason !== null) throw new Error('command result is not successful');
  if (!Number.isFinite(value.peakObservedRssMiB) || value.peakObservedRssMiB < 0 || value.peakObservedRssMiB > RELEASE_COMMAND_LIMITS.maxRssMiB) throw new Error('command RSS evidence exceeds limit');
  if (!Array.isArray(value.inputs)) throw new Error('command inputs are missing');
  const inputPaths = value.inputs.map(input => input.path);
  if (new Set(inputPaths).size !== inputPaths.length || inputPaths.some((path, index) => index > 0 && inputPaths[index - 1]!.localeCompare(path) >= 0)) throw new Error('command inputs must be unique and sorted');
  for (const input of value.inputs) if (!equalHash(input, fileHash(input.path))) throw new Error('command input hash mismatch');
  if (value.stdout.path === value.stderr.path) throw new Error('command logs must be distinct');
  const stdout = fileHash(value.stdout.path, artifact), stderr = fileHash(value.stderr.path, artifact);
  if (!equalHash(value.stdout, stdout) || !equalHash(value.stderr, stderr)) throw new Error('command log hash mismatch');
  if (stdout.bytes + stderr.bytes > RELEASE_COMMAND_LIMITS.maxOutputBytes) throw new Error('command output evidence exceeds limit');
  return Object.freeze({ ...value, argv: Object.freeze([...value.argv]), inputs: Object.freeze(value.inputs.map(input => Object.freeze({ ...input }))), stdout, stderr });
}
function atomicWrite(path: string, bytes: Uint8Array): void { const temp = `${path}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`; try { writeFileSync(temp, bytes, { flag: 'wx' }); renameSync(temp, path); } finally { rmSync(temp, { force: true }); } }
function bestEffortRemoveFile(path: string): void { try { const stat = lstatSync(path); if (stat.isFile() || stat.isSymbolicLink()) rmSync(path, { force: true }); } catch {} }

export type ReleaseSupervisor = typeof supervise;
export async function runReleaseCommand(args: ReleaseCommandArgs, limits: ProcessLimits = RELEASE_COMMAND_LIMITS, supervisor: ReleaseSupervisor = supervise): Promise<ReleaseCommandEvidence> {
  assertSafeReleaseArgv(args.argv);
  const stdoutPath = `${args.record}.stdout`, stderrPath = `${args.record}.stderr`;
  bestEffortRemoveFile(args.record); bestEffortRemoveFile(stdoutPath); bestEffortRemoveFile(stderrPath);
  try {
    const inputs = args.inputs.map(path => fileHash(path)).sort((a, b) => a.path.localeCompare(b.path));
    const startedAt = new Date().toISOString();
    const result = await supervisor(args.argv[0]!, args.argv.slice(1), args.cwd, limits);
    const finishedAt = new Date().toISOString();
    if (result.status !== 0 || result.signal !== null || result.terminationReason !== undefined)
      throw new Error(`release command failed: ${result.terminationReason ?? result.signal ?? `exit ${result.status}`}`);
    atomicWrite(stdoutPath, new TextEncoder().encode(result.stdout));
    atomicWrite(stderrPath, new TextEncoder().encode(result.stderr));
    const record: ReleaseCommandEvidence = Object.freeze({ argv: Object.freeze([...args.argv]), cwd: args.cwd, startedAt, finishedAt,
      elapsedMilliseconds: result.milliseconds, exitCode: 0, signal: null, terminationReason: null, peakObservedRssMiB: result.peakObservedRssMiB,
      inputs: Object.freeze(inputs), stdout: fileHash(stdoutPath, args.artifactDir), stderr: fileHash(stderrPath, args.artifactDir) });
    atomicWrite(args.record, new TextEncoder().encode(`${JSON.stringify(record, null, 2)}\n`));
    return record;
  } catch (error) {
    bestEffortRemoveFile(args.record); bestEffortRemoveFile(stdoutPath); bestEffortRemoveFile(stderrPath); throw error;
  }
}
if (basename(process.argv[1] ?? '') === 'run-release-command.ts') runReleaseCommand(parseReleaseCommandArgs(process.argv.slice(2))).catch(error => { console.error(error); process.exitCode = 1; });
