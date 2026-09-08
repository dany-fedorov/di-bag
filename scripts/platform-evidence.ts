import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

export type PlatformTool = 'node' | 'npm' | 'classic6' | 'bun' | 'deno' | 'esbuild' | 'playwright' | 'chromium';
export type ToolUnavailableReason = 'not-provisioned' | 'version-mismatch' | 'hash-mismatch';
export type ToolPin =
  | { status: 'pinned'; argv: readonly [string, ...string[]]; versionArgv: readonly [string, ...string[]]; version: string; versionText: string; sha256: string }
  | { status: 'unavailable'; reason: ToolUnavailableReason };
export type PlatformVersions = { schema: 1 } & Record<PlatformTool, ToolPin>;
export type VerifiedTool = Extract<ToolPin, { status: 'pinned' }> & { name: PlatformTool; hashPath: string };

export type PlatformEnvironment = {
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
};
export type PlatformAssertion = { status: 'pass' } | { status: 'fail'; reason: string };
export type PlatformRow = {
  schema: 1;
  lane: string;
  status: 'pass' | 'fail' | 'unavailable';
  utc: string;
  git: { sha: string; dirty: boolean };
  reason?: string;
  [key: string]: unknown;
};

type PackFile = { path: string; size?: number };
type PackResult = { filename: string; files: PackFile[]; name?: string; version?: string };
export type PackedArchive = {
  path: string;
  sha256: string;
  packageTree: string;
  files: readonly string[];
};

function sha256File(path: string): string {
  return createHash('sha256').update(Uint8Array.from(readFileSync(path))).digest('hex');
}

function isStringTuple(value: unknown): value is [string, ...string[]] {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.length > 0);
}

function readManifest(root: string): PlatformVersions {
  const path = join(root, 'tools', 'platform-versions.json');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || (parsed as { schema?: unknown }).schema !== 1) {
    throw new Error('platform tool manifest must have schema 1');
  }
  return parsed as PlatformVersions;
}

function assertPin(name: PlatformTool, value: unknown): ToolPin {
  if (!value || typeof value !== 'object') throw new Error(`platform tool ${name} has no manifest entry`);
  const pin = value as Partial<ToolPin>;
  if (pin.status === 'unavailable') {
    if (!['not-provisioned', 'version-mismatch', 'hash-mismatch'].includes(String(pin.reason))) {
      throw new Error(`platform tool ${name} has an invalid unavailable reason`);
    }
    return pin as ToolPin;
  }
  if (pin.status !== 'pinned' || !isStringTuple(pin.argv) || !isStringTuple(pin.versionArgv)
    || typeof pin.version !== 'string' || !pin.version
    || typeof pin.versionText !== 'string' || !pin.versionText
    || typeof pin.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(pin.sha256)) {
    throw new Error(`platform tool ${name} has incomplete pinned identity`);
  }
  if (!pin.argv.every(isAbsolute) || !pin.versionArgv[0] || !isAbsolute(pin.versionArgv[0])) {
    throw new Error(`platform tool ${name} argv must use absolute paths`);
  }
  const versionArgv = pin.versionArgv;
  if (pin.argv.some((part, index) => versionArgv[index] !== part)) {
    throw new Error(`platform tool ${name} version argv must extend invocation argv`);
  }
  return pin as ToolPin;
}

function invokedArtifact(pin: Extract<ToolPin, { status: 'pinned' }>): string {
  // Script-backed tools are invoked through pinned Node; the script is the tool artifact.
  return pin.argv[1] ?? pin.argv[0];
}

export async function verifyTool(root: string, name: PlatformTool): Promise<VerifiedTool | { status: 'unavailable'; reason: ToolUnavailableReason }> {
  const pin = assertPin(name, readManifest(root)[name]);
  if (pin.status === 'unavailable') return pin;
  const hashPath = invokedArtifact(pin);
  try {
    if (!existsSync(pin.argv[0]) || !statSync(pin.argv[0]).isFile()
      || !existsSync(hashPath) || !statSync(hashPath).isFile()) return { status: 'unavailable', reason: 'not-provisioned' };
    if (sha256File(hashPath) !== pin.sha256) return { status: 'unavailable', reason: 'hash-mismatch' };
    const probe = spawnSync(pin.versionArgv[0], pin.versionArgv.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (probe.error || probe.status !== 0 || probe.signal !== null || probe.stderr !== '' || probe.stdout !== pin.versionText) {
      return { status: 'unavailable', reason: 'version-mismatch' };
    }
  } catch {
    return { status: 'unavailable', reason: 'not-provisioned' };
  }
  return { ...pin, name, hashPath };
}

export function stableJson(value: unknown): string {
  const seen = new Set<object>();
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      if (seen.has(item)) throw new TypeError('cannot serialize circular platform evidence');
      seen.add(item);
      const sorted: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(item).sort()) sorted[key] = normalize((item as Record<string, unknown>)[key]);
      seen.delete(item);
      return sorted;
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function evaluatePlatformChild(expected: { lane: string; [key: string]: unknown }, supervised: PlatformEnvironment): PlatformAssertion {
  if (supervised.signal !== null) return { status: 'fail', reason: `child terminated by ${supervised.signal}` };
  if (supervised.status !== 0) return { status: 'fail', reason: `child exited with status ${String(supervised.status)}` };
  if (supervised.stderr !== '') return { status: 'fail', reason: 'child stderr is not empty' };
  let actual: unknown;
  try { actual = JSON.parse(supervised.stdout); }
  catch { return { status: 'fail', reason: 'child stdout is not one canonical JSON object' }; }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)
    || supervised.stdout !== `${JSON.stringify(actual)}\n`) {
    return { status: 'fail', reason: 'child stdout is not one canonical JSON object' };
  }
  if ((actual as { lane?: unknown }).lane !== expected.lane) return { status: 'fail', reason: 'child lane mismatch' };
  if (stableJson(actual) !== stableJson(expected)) return { status: 'fail', reason: 'child result mismatch' };
  return { status: 'pass' };
}

function runExact(tool: VerifiedTool, args: readonly string[], cwd: string): PlatformEnvironment {
  const command = tool.argv[0];
  const result = spawnSync(command, [...tool.argv.slice(1), ...args], { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
}

function requiredArchiveFiles(packageTree: string): string[] {
  const packageJson = JSON.parse(readFileSync(join(packageTree, 'package.json'), 'utf8')) as {
    exports?: Record<string, { default?: string; types?: string }>;
  };
  const required = new Set(['package.json', 'README.md', 'LICENSE']);
  for (const target of Object.values(packageJson.exports ?? {})) {
    if (typeof target.default === 'string') required.add(target.default.replace(/^\.\//, ''));
    if (typeof target.types === 'string') required.add(target.types.replace(/^\.\//, ''));
  }
  return [...required].sort();
}

export function validatePackOutput(packageTree: string, stdout: string, stderr = ''): PackResult {
  if (stderr !== '') throw new Error('npm pack stderr is not empty');
  let parsed: unknown;
  try { parsed = JSON.parse(stdout); }
  catch { throw new Error('npm pack output is not JSON'); }
  if (!Array.isArray(parsed) || parsed.length !== 1) throw new Error('npm pack must produce exactly one archive');
  const result = parsed[0] as Partial<PackResult>;
  if (typeof result.filename !== 'string' || !result.filename || !Array.isArray(result.files)) {
    throw new Error('npm pack result is incomplete');
  }
  if (isAbsolute(result.filename) || basename(result.filename) !== result.filename) {
    throw new Error('npm pack returned an unsafe archive filename');
  }
  const files = new Set(result.files.map(file => file?.path).filter((path): path is string => typeof path === 'string'));
  for (const required of requiredArchiveFiles(packageTree)) {
    if (!files.has(required)) throw new Error(`packed archive is missing ${required}`);
  }
  return result as PackResult;
}

function tarText(bytes: Uint8Array, start: number, length: number): string {
  return new TextDecoder().decode(bytes.subarray(start, start + length)).replace(/\0.*$/s, '');
}

function tarOctal(bytes: Uint8Array, start: number, length: number): number {
  const value = tarText(bytes, start, length).trim();
  if (!/^[0-7]+$/.test(value)) throw new Error('packed archive has an invalid tar header');
  return Number.parseInt(value, 8);
}

function archiveFiles(path: string): Set<string> {
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(gunzipSync(Uint8Array.from(readFileSync(path)))); }
  catch { throw new Error('packed archive is not a gzip tar archive'); }
  const files = new Set<string>();
  let offset = 0, ended = false;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) { ended = true; break; }
    if (tarText(header, 257, 6) !== 'ustar') throw new Error('packed archive has an invalid tar header');
    const recordedChecksum = tarOctal(header, 148, 8);
    let actualChecksum = 0;
    for (let index = 0; index < header.length; index++) {
      actualChecksum += index >= 148 && index < 156 ? 0x20 : header[index] ?? 0;
    }
    if (recordedChecksum !== actualChecksum) throw new Error('packed archive has an invalid tar checksum');
    const size = tarOctal(header, 124, 12);
    const name = tarText(header, 0, 100);
    const prefix = tarText(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const next = offset + 512 + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(size) || next > bytes.length) throw new Error('packed archive has a truncated tar entry');
    const type = header[156];
    if (type !== 0 && type !== 0x30 && type !== 0x35) {
      throw new Error(`packed archive has unsupported tar entry type ${String.fromCharCode(type ?? 0)}`);
    }
    if (type === 0 || type === 0x30) {
      if (!fullName.startsWith('package/')) throw new Error('packed archive has a file outside package/');
      const relative = fullName.slice('package/'.length);
      if (!relative || relative.split('/').some(part => part === '' || part === '.' || part === '..')) {
        throw new Error('packed archive has an unsafe file path');
      }
      if (files.has(relative)) throw new Error(`packed archive has duplicate file ${relative}`);
      files.add(relative);
    }
    offset = next;
  }
  if (!ended) throw new Error('packed archive has no tar terminator');
  return files;
}

export function validatePackedArchive(archive: PackedArchive): void {
  if (!existsSync(archive.path) || !statSync(archive.path).isFile()) throw new Error('packed archive does not exist');
  if (sha256File(archive.path) !== archive.sha256) throw new Error('packed archive SHA-256 mismatch');
  const claimed = new Set(archive.files);
  const actual = archiveFiles(archive.path);
  for (const required of requiredArchiveFiles(archive.packageTree)) {
    if (!claimed.has(required)) throw new Error(`packed archive is missing ${required}`);
    if (!actual.has(required)) throw new Error(`packed archive bytes are missing ${required}`);
  }
  for (const file of claimed) if (!actual.has(file)) throw new Error(`packed archive bytes are missing ${file}`);
}

export async function packIsolatedClassic(root: string, node: VerifiedTool, npm: VerifiedTool, classic6: VerifiedTool): Promise<PackedArchive> {
  const packageTree = mkdtempSync(join(tmpdir(), 'di-bag-platform-'));
  for (const name of ['src', 'package.json', 'tsconfig.json', 'tsconfig.build.json', 'README.md', 'LICENSE']) {
    const source = join(root, name);
    if (!existsSync(source)) throw new Error(`isolated package source is missing ${name}`);
    cpSync(source, join(packageTree, name), { recursive: true });
  }
  const build = runExact(node, [...classic6.argv.slice(1), '-p', 'tsconfig.build.json'], packageTree);
  if (build.signal !== null || build.status !== 0 || build.stderr !== '') throw new Error(`isolated classic build failed: ${build.stderr || build.stdout}`);
  const packed = runExact(node, [...npm.argv.slice(1), 'pack', '--ignore-scripts', '--json'], packageTree);
  if (packed.signal !== null || packed.status !== 0) throw new Error(`npm pack failed: ${packed.stderr || packed.stdout}`);
  const result = validatePackOutput(packageTree, packed.stdout, packed.stderr);
  const path = resolve(packageTree, result.filename);
  const archive: PackedArchive = { path, packageTree, sha256: sha256File(path), files: result.files.map(file => file.path).sort() };
  validatePackedArchive(archive);
  return archive;
}

export async function writePlatformEvidence(root: string, row: PlatformRow): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(row.utc) || !/^[a-f0-9]{7,40}$/.test(row.git.sha)) {
    throw new Error('platform evidence row needs UTC time and Git SHA');
  }
  const directory = join(root, 'docs', 'benchmarks', 'results', `${row.utc.slice(0, 10)}-${row.git.sha.slice(0, 7)}`);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'platform.jsonl');
  writeFileSync(path, `${stableJson(row)}\n`, { flag: 'a' });
  return path;
}
