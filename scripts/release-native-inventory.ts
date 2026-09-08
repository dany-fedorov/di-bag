import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { nativeDiagnosticGapMessages } from '../tests/native-diagnostic-markers.ts';

export type NativeGapFingerprint = Readonly<{ id: string; fixture: string; markerLine: number; markerOccurrence: number; code: number; normalizedMessage: string; fingerprint: string }>;
export type NativeInventoryArgs = Readonly<{ reviewedRoot: string; freshJsonl: string; out: string }>;

export function normalizeDiagnosticMessage(message: string): string { return message.replace(/\r\n?/g, '\n'); }
function fingerprint(record: Omit<NativeGapFingerprint, 'fingerprint'>): string {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}
function canonicalFile(path: string, label: string): string {
  if (!isAbsolute(path) || resolve(path) !== path) throw new Error(`${label} must be an absolute canonical path`);
  return path;
}
export function parseNativeInventoryArgs(argv: readonly string[]): NativeInventoryArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const option = argv[i], value = argv[i + 1];
    if (!['--reviewed-root', '--fresh-jsonl', '--out'].includes(option ?? '')) throw new Error(`unsupported option: ${option}`);
    if (!value || values.has(option!)) throw new Error(`missing or duplicate value for ${option}`);
    values.set(option!, value);
  }
  const reviewedValue = values.get('--reviewed-root') ?? '';
  const reviewedRoot = resolve(reviewedValue);
  if (!reviewedValue || realpathSync(reviewedRoot) !== reviewedRoot) throw new Error('reviewed root must be canonical');
  return { reviewedRoot, freshJsonl: canonicalFile(values.get('--fresh-jsonl') ?? '', 'fresh JSONL'), out: canonicalFile(values.get('--out') ?? '', 'output') };
}
function sortedFiles(root: string): string[] {
  const result: string[] = [];
  const visit = (directory: string) => { for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = resolve(directory, entry.name); if (entry.isDirectory()) visit(path); else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(path); } };
  visit(root); return result.sort();
}
export function collectReviewedNativeGaps(root: string): readonly NativeGapFingerprint[] {
  const canonicalRoot = realpathSync(root);
  const records: NativeGapFingerprint[] = [];
  for (const file of sortedFiles(canonicalRoot)) {
    const fixture = relative(canonicalRoot, file).split(sep).join('/');
    const counts = new Map<string, number>();
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      const match = /^\s*\/\/ diagnostic-native-gap: ([a-z-]+)\s*$/.exec(line);
      if (!match) return;
      const id = match[1]!, message = nativeDiagnosticGapMessages[id];
      if (message === undefined) throw new Error(`unknown native gap ID: ${id}`);
      const markerOccurrence = (counts.get(id) ?? 0) + 1; counts.set(id, markerOccurrence);
      const base = { id, fixture, markerLine: index + 1, markerOccurrence, code: 2769, normalizedMessage: normalizeDiagnosticMessage(message) };
      records.push(Object.freeze({ ...base, fingerprint: fingerprint(base) }));
    });
  }
  records.sort(compareGap);
  assertUnique(records, 'reviewed');
  return Object.freeze(records);
}
function compareGap(a: NativeGapFingerprint, b: NativeGapFingerprint): number {
  return a.fixture.localeCompare(b.fixture) || a.markerLine - b.markerLine || a.id.localeCompare(b.id) || a.markerOccurrence - b.markerOccurrence;
}
function key(gap: NativeGapFingerprint): string { return `${gap.fixture}\0${gap.markerLine}\0${gap.id}\0${gap.markerOccurrence}`; }
function assertUnique(gaps: readonly NativeGapFingerprint[], label: string): void {
  const seen = new Set<string>();
  for (const gap of gaps) { const value = key(gap); if (seen.has(value)) throw new Error(`duplicate ${label} native gap occurrence`); seen.add(value); }
}
function assertFingerprint(gap: NativeGapFingerprint): void {
  const base = { id: gap.id, fixture: gap.fixture, markerLine: gap.markerLine, markerOccurrence: gap.markerOccurrence, code: gap.code, normalizedMessage: normalizeDiagnosticMessage(gap.normalizedMessage) };
  if (gap.normalizedMessage !== base.normalizedMessage || fingerprint(base) !== gap.fingerprint) throw new Error('changed native gap fingerprint');
}
export function collectFreshNativeGaps(jsonl: string, reviewed: readonly NativeGapFingerprint[]): readonly NativeGapFingerprint[] {
  const fresh: NativeGapFingerprint[] = [];
  const occurrenceByFixtureId = new Map<string, number>();
  const reviewedByPrimary = new Map<string, NativeGapFingerprint>();
  // Fresh check output identifies the primary marker; reviewed declaration is the following line.
  for (const item of reviewed) reviewedByPrimary.set(`${item.fixture}\0${item.markerLine - 1}\0${item.id}`, item);
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^> di-bag@[^ ]+ check:native$/.test(line) || line === '> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-native-contracts.ts') continue;
    let row: any; try { row = JSON.parse(line); } catch { throw new Error('fresh native inventory contains invalid JSONL'); }
    if (!Array.isArray(row.gaps)) continue;
    for (const gap of row.gaps) {
      const fixture = typeof row.fixture === 'string' ? row.fixture.split('\\').join('/') : '';
      const id = gap?.id, primaryLine = gap?.primary?.line, diagnostic = gap?.diagnostic;
      if (!id || !fixture || !Number.isInteger(primaryLine) || diagnostic?.code !== 2769 || typeof diagnostic?.message !== 'string') throw new Error('fresh native gap is malformed');
      const reviewedGap = reviewedByPrimary.get(`${fixture}\0${primaryLine}\0${id}`);
      if (!reviewedGap) throw new Error('new or moved native gap occurrence');
      const counterKey = `${fixture}\0${id}`;
      const markerOccurrence = (occurrenceByFixtureId.get(counterKey) ?? 0) + 1; occurrenceByFixtureId.set(counterKey, markerOccurrence);
      const base = { id, fixture, markerLine: reviewedGap.markerLine, markerOccurrence, code: diagnostic.code, normalizedMessage: normalizeDiagnosticMessage(diagnostic.message) };
      fresh.push(Object.freeze({ ...base, fingerprint: fingerprint(base) }));
    }
  }
  fresh.sort(compareGap); assertUnique(fresh, 'fresh');
  const reviewedKeys = new Map(reviewed.map(item => [key(item), item]));
  for (const gap of fresh) {
    assertFingerprint(gap);
    const expected = reviewedKeys.get(key(gap));
    if (!expected || expected.fingerprint !== gap.fingerprint) throw new Error('new or changed native gap fingerprint');
  }
  return Object.freeze(fresh);
}
export function createNativeInventory(reviewedRoot: string, freshJsonl: string): Readonly<{ reviewedGaps: readonly NativeGapFingerprint[]; freshGaps: readonly NativeGapFingerprint[] }> {
  const reviewed = collectReviewedNativeGaps(reviewedRoot);
  return Object.freeze({ reviewedGaps: reviewed, freshGaps: collectFreshNativeGaps(freshJsonl, reviewed) });
}
function atomicWrite(path: string, value: string): void { const temp = `${path}.tmp-${process.pid}`; try { writeFileSync(temp, value, { flag: 'wx' }); renameSync(temp, path); } finally { rmSync(temp, { force: true }); } }
if (basename(process.argv[1] ?? '') === 'release-native-inventory.ts') {
  const args = parseNativeInventoryArgs(process.argv.slice(2));
  if (!lstatSync(args.reviewedRoot).isDirectory()) throw new Error('reviewed root must be a directory');
  atomicWrite(args.out, `${JSON.stringify(createNativeInventory(args.reviewedRoot, readFileSync(args.freshJsonl, 'utf8')), null, 2)}\n`);
}
