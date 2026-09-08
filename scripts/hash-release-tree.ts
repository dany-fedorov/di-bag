import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export type ReleaseTreeArgs = Readonly<{ artifactDir: string; root: string; out: string }>;
export type ReleaseTreeEntry = Readonly<{ path: string; bytes: number; sha256: string }>;

function exactAbsolute(path: string, label: string): string { if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`${label} must be an absolute canonical path`); return path; }
function within(parent: string, child: string): boolean { const rel = relative(parent, child); return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel); }
export function parseReleaseTreeArgs(argv: readonly string[]): ReleaseTreeArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index], value = argv[index + 1];
    if (!['--artifact-dir', '--root', '--out'].includes(option ?? '')) throw new Error(`unsupported option: ${option}`);
    if (!value || values.has(option!)) throw new Error(`missing or duplicate value for ${option}`); values.set(option!, value);
  }
  const artifactDir = realpathSync(exactAbsolute(values.get('--artifact-dir') ?? '', 'artifact directory'));
  const root = realpathSync(exactAbsolute(values.get('--root') ?? '', 'root'));
  if (!lstatSync(root).isDirectory()) throw new Error('root must be a directory');
  const out = exactAbsolute(values.get('--out') ?? '', 'output');
  if (!within(artifactDir, out)) throw new Error('output must be contained by artifact directory');
  if (realpathSync(dirname(out)) !== dirname(out)) throw new Error('output parent must not contain symlinks');
  if (within(root, out) || root === out) throw new Error('output must not alias the hashed tree');
  return Object.freeze({ artifactDir, root, out });
}
function scan(root: string): string[] {
  const paths: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`release tree contains symlink: ${relative(root, path)}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) paths.push(path);
      else throw new Error(`release tree contains special file: ${relative(root, path)}`);
    }
  };
  visit(root); return paths;
}
function hashOne(root: string, path: string): ReleaseTreeEntry {
  const descriptor = openSync(path, 'r');
  try {
    if (realpathSync(`/proc/self/fd/${descriptor}`) !== path || !within(root, path)) throw new Error('tree descriptor escaped expected path');
    const before = fstatSync(descriptor); if (!before.isFile()) throw new Error('tree entry changed type');
    const hash = createHash('sha256'); const buffer = new Uint8Array(Math.min(64 * 1024, Math.max(1, before.size))); let offset = 0;
    while (offset < before.size) { const count = readSync(descriptor, buffer, 0, Math.min(buffer.length, before.size - offset), offset); if (!count) throw new Error('tree entry was truncated'); hash.update(buffer.subarray(0, count)); offset += count; }
    const after = fstatSync(descriptor); if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('tree entry mutated while hashing');
    return Object.freeze({ path: relative(root, path).split(sep).join('/'), bytes: before.size, sha256: hash.digest('hex') });
  } finally { closeSync(descriptor); }
}
export function hashReleaseTree(root: string): Readonly<{ schemaVersion: 1; files: readonly ReleaseTreeEntry[] }> {
  const first = scan(root); if (!first.length) throw new Error('release tree must not be empty');
  const files = first.map(path => hashOne(root, path));
  const second = scan(root);
  if (first.length !== second.length || first.some((path, index) => path !== second[index])) throw new Error('release tree changed while hashing');
  return Object.freeze({ schemaVersion: 1, files: Object.freeze(files) });
}
function atomicWrite(path: string, value: string): void { const temp = `${path}.tmp-${process.pid}`; try { writeFileSync(temp, value, { flag: 'wx' }); renameSync(temp, path); } finally { rmSync(temp, { force: true }); } }
if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve('scripts/hash-release-tree.ts')) { const args = parseReleaseTreeArgs(process.argv.slice(2)); atomicWrite(args.out, `${JSON.stringify(hashReleaseTree(args.root), null, 2)}\n`); }
