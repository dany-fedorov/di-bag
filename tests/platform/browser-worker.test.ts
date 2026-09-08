import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  assertBrowserMetafile,
  bundleBrowserRoot,
  evaluateBrowserWorkerProtocol,
  runBrowserWorkerLane,
  validateBrowserBundle,
  verifyTool,
  type BrowserBundle,
  type BrowserWorkerDriver,
  type PackedArchive,
  type VerifiedTool,
} from '../../scripts/platform-evidence';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function consumerFixture() {
  const consumer = mkdtempSync(join(tmpdir(), 'di-bag-browser-test-'));
  roots.push(consumer);
  for (const directory of ['node_modules/di-bag/dist', 'node_modules/other', 'portable']) mkdirSync(join(consumer, directory), { recursive: true });
  for (const file of ['index.js', 'internal.js', 'node.js']) writeFileSync(join(consumer, 'node_modules/di-bag/dist', file), `// ${file}\n`);
  writeFileSync(join(consumer, 'browser-entry.ts'), 'entry\n');
  writeFileSync(join(consumer, 'portable/contract.ts'), 'fixture\n');
  writeFileSync(join(consumer, 'node_modules/other/index.js'), 'foreign\n');
  const foreignFixture = join(dirname(consumer), `${basename(consumer)}-foreign.ts`);
  writeFileSync(foreignFixture, 'foreign\n');
  roots.push(foreignFixture);
  return consumer;
}

function cleanMetafile(_consumer: string): { inputs: Record<string, { bytes?: number; imports?: Array<{ path: string; kind?: string }> }>; outputs: Record<string, unknown> } {
  return {
    inputs: {
      'browser-entry.ts': { bytes: 6, imports: [{ path: 'node_modules/di-bag/dist/index.js', kind: 'import-statement' }] },
      'portable/contract.ts': { bytes: 8, imports: [] },
      'node_modules/di-bag/dist/index.js': { bytes: 12, imports: [{ path: 'node_modules/di-bag/dist/internal.js', kind: 'import-statement' }] },
      'node_modules/di-bag/dist/internal.js': { bytes: 15, imports: [] },
    },
    outputs: { 'worker.js': { bytes: 100, inputs: {} } },
  };
}

function browserBundle(): BrowserBundle {
  const consumer = consumerFixture();
  const path = join(consumer, 'worker.js');
  const metafilePath = join(consumer, 'worker-meta.json');
  const bytes = Uint8Array.from(Buffer.from('minified-worker();'));
  const metafile = `${JSON.stringify(cleanMetafile(consumer))}\n`;
  writeFileSync(path, bytes);
  writeFileSync(metafilePath, metafile);
  return {
    path,
    sha256: sha256(bytes),
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
    metafilePath,
    metafileSha256: sha256(metafile),
    resolvedDiBag: join(consumer, 'node_modules/di-bag/dist/index.js'),
  };
}

const portableResult = {
  aliasCanonical: true,
  cleanupLog: ['scoped', 'transient-2', 'transient-1', 'root'],
  inspectionFrozen: true,
  metadataFrozen: true,
  rawDisposerIdentity: true,
  rawPromiseIdentity: true,
  rootOnce: true,
  scopedOnce: true,
  transientDistinct: true,
} as const;

test('browser metafile accepts only the installed root export and package-local dependencies', () => {
  const consumer = consumerFixture();
  expect(assertBrowserMetafile(cleanMetafile(consumer), consumer)).toBe(
    join(consumer, 'node_modules/di-bag/dist/index.js'),
  );

  const mutations: Array<[string, unknown, string]> = [
    ['missing root', { inputs: { 'browser-entry.ts': {}, 'portable/contract.ts': {} }, outputs: {} }, 'exactly one di-bag root entry'],
    ['node facade', { inputs: { ...cleanMetafile(consumer).inputs, 'node_modules/di-bag/dist/node.js': {} }, outputs: {} }, 'node facade'],
    ['node builtin input', { inputs: { ...cleanMetafile(consumer).inputs, 'node:util/types': {} }, outputs: {} }, 'node: input'],
    ['node builtin external import', { inputs: { ...cleanMetafile(consumer).inputs, 'browser-entry.ts': { imports: [{ path: 'node:fs', external: true }] } }, outputs: {} }, 'node: input'],
    ['node builtin output import', { inputs: cleanMetafile(consumer).inputs, outputs: { 'worker.js': { imports: [{ path: 'node:path', external: true }] } } }, 'node: input'],
    ['foreign package input', { inputs: { ...cleanMetafile(consumer).inputs, 'node_modules/other/index.js': {} }, outputs: {} }, 'outside the installed di-bag archive'],
    ['parent traversal', { inputs: { ...cleanMetafile(consumer).inputs, [`../${basename(consumer)}-foreign.ts`]: {} }, outputs: {} }, 'outside the browser consumer'],
  ];
  for (const [name, metafile, message] of mutations) {
    expect(() => assertBrowserMetafile(metafile, consumer), name).toThrow(message);
  }

  symlinkSync('../../browser-entry.ts', join(consumer, 'node_modules/other/linked.js'));
  const disguisedForeign = cleanMetafile(consumer);
  disguisedForeign.inputs['node_modules/other/linked.js'] = {};
  expect(() => assertBrowserMetafile(disguisedForeign, consumer)).toThrow('outside the installed di-bag archive');

  const alias = join(consumer, 'node_modules/di-bag/dist/root-alias.js');
  symlinkSync('index.js', alias);
  const duplicateRoot = cleanMetafile(consumer);
  duplicateRoot.inputs['node_modules/di-bag/dist/root-alias.js'] = { bytes: 12, imports: [] };
  expect(() => assertBrowserMetafile(duplicateRoot, consumer)).toThrow('exactly one di-bag root entry');
});

test('browser bundle validation rejects stale bytes, sizes, gzip size, metafile and root identity', () => {
  const bundle = browserBundle();
  expect(validateBrowserBundle(bundle)).toEqual({ bytes: bundle.bytes, gzipBytes: bundle.gzipBytes });

  const cases: Array<[string, BrowserBundle, string]> = [
    ['bundle hash', { ...bundle, sha256: '0'.repeat(64) }, 'bundle SHA-256 mismatch'],
    ['byte count', { ...bundle, bytes: bundle.bytes + 1 }, 'bundle byte count mismatch'],
    ['gzip count', { ...bundle, gzipBytes: bundle.gzipBytes + 1 }, 'bundle gzip byte count mismatch'],
    ['metafile hash', { ...bundle, metafileSha256: '0'.repeat(64) }, 'metafile SHA-256 mismatch'],
    ['root path', { ...bundle, resolvedDiBag: join(resolve(bundle.path, '..'), 'node_modules/di-bag/dist/internal.js') }, 'resolved di-bag root mismatch'],
  ];
  for (const [name, mutated, message] of cases) expect(() => validateBrowserBundle(mutated), name).toThrow(message);

  writeFileSync(bundle.path, 'changed');
  expect(() => validateBrowserBundle(bundle)).toThrow('bundle SHA-256 mismatch');

  const empty = browserBundle();
  writeFileSync(empty.path, '');
  expect(() => validateBrowserBundle({ ...empty, sha256: sha256(''), bytes: 0, gzipBytes: gzipSync('').length }))
    .toThrow('browser bundle is empty');
  const missingMetafile = browserBundle();
  rmSync(missingMetafile.metafilePath);
  expect(() => validateBrowserBundle(missingMetafile)).toThrow('browser metafile does not exist');
  const malformedMetafile = browserBundle();
  writeFileSync(malformedMetafile.metafilePath, '{broken');
  expect(() => validateBrowserBundle({ ...malformedMetafile, metafileSha256: sha256('{broken') })).toThrow('invalid esbuild metafile');
});

test('Worker protocol accepts exactly one structured portable result and rejects hostile transcripts', () => {
  const clean = { messages: [{ lane: 'browser-worker-minified', result: portableResult }], errors: [], console: [], timedOut: false };
  expect(evaluateBrowserWorkerProtocol(clean)).toEqual({ status: 'pass' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [] })).toEqual({ status: 'fail', reason: 'Worker posted no message' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [...clean.messages, clean.messages[0]] })).toEqual({ status: 'fail', reason: 'Worker posted extra messages' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [{ lane: 'wrong', result: portableResult }] })).toEqual({ status: 'fail', reason: 'Worker lane mismatch' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [{ lane: 'browser-worker-minified', result: { ...portableResult, rootOnce: false } }] })).toEqual({ status: 'fail', reason: 'Worker result mismatch' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [null] })).toEqual({ status: 'fail', reason: 'Worker message is not an object' });
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [{ lane: 'browser-worker-minified', result: cyclic }] })).toEqual({ status: 'fail', reason: 'Worker result mismatch' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, errors: ['boom'] })).toEqual({ status: 'fail', reason: 'Worker error: boom' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, console: ['noise'] })).toEqual({ status: 'fail', reason: 'Worker console output is not empty' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, timedOut: true })).toEqual({ status: 'fail', reason: 'Worker timed out' });
});

test('browser Worker lane rechecks the artifact before execution and maps protocol failures', async () => {
  const bundle = browserBundle();
  const chromium = {
    status: 'pinned', name: 'chromium', argv: ['/fake/chromium'], versionArgv: ['/fake/chromium', '--version'],
    version: '1', versionText: '1\n', sha256: '1'.repeat(64), hashPath: '/fake/chromium',
  } satisfies VerifiedTool;
  const driver: BrowserWorkerDriver = async () => ({
    messages: [{ lane: 'browser-worker-minified', result: portableResult }], errors: [], console: [], timedOut: false,
  });
  await expect(runBrowserWorkerLane(bundle, chromium, driver)).resolves.toMatchObject({ status: 'pass', lane: 'browser-worker-minified' });
  await expect(runBrowserWorkerLane({ ...bundle, sha256: '0'.repeat(64) }, chromium, driver)).resolves.toMatchObject({ status: 'fail', reason: 'bundle SHA-256 mismatch' });
  const errorDriver: BrowserWorkerDriver = async () => ({ messages: [], errors: ['worker exploded'], console: [], timedOut: false });
  await expect(runBrowserWorkerLane(bundle, chromium, errorDriver)).resolves.toMatchObject({ status: 'fail', reason: 'Worker error: worker exploded' });
  const timeoutDriver: BrowserWorkerDriver = async () => ({ messages: [], errors: [], console: [], timedOut: true });
  await expect(runBrowserWorkerLane(bundle, chromium, timeoutDriver)).resolves.toMatchObject({ status: 'fail', reason: 'Worker timed out' });
  const extraDriver: BrowserWorkerDriver = async () => ({
    messages: [
      { lane: 'browser-worker-minified', result: portableResult },
      { lane: 'browser-worker-minified', result: portableResult },
    ],
    errors: [], console: [], timedOut: false,
  });
  await expect(runBrowserWorkerLane(bundle, chromium, extraDriver)).resolves.toMatchObject({ status: 'fail', reason: 'Worker posted extra messages' });
  const consoleDriver: BrowserWorkerDriver = async () => ({
    messages: [{ lane: 'browser-worker-minified', result: portableResult }], errors: [], console: ['debug'], timedOut: false,
  });
  await expect(runBrowserWorkerLane(bundle, chromium, consoleDriver)).resolves.toMatchObject({ status: 'fail', reason: 'Worker console output is not empty' });
});

test('unprovisioned browser tools stay unavailable without archive or bundle fallback', async () => {
  const root = resolve(__dirname, '../..');
  const [esbuild, chromium] = await Promise.all([verifyTool(root, 'esbuild'), verifyTool(root, 'chromium')]);
  expect(esbuild).toEqual({ status: 'unavailable', reason: 'not-provisioned' });
  expect(chromium).toEqual({ status: 'unavailable', reason: 'not-provisioned' });
  const archive = { path: '/missing/archive.tgz', packageTree: '/missing/tree', sha256: '0'.repeat(64), files: [] } satisfies PackedArchive;
  await expect(bundleBrowserRoot(archive, esbuild)).rejects.toThrow('esbuild unavailable: not-provisioned');
  await expect(runBrowserWorkerLane(browserBundle(), chromium)).resolves.toMatchObject({
    lane: 'browser-worker-minified', status: 'unavailable', reason: 'not-provisioned',
  });

  const fakeChromium = {
    status: 'pinned', name: 'chromium', argv: ['/fake/chromium'], versionArgv: ['/fake/chromium', '--version'],
    version: '1', versionText: '1\n', sha256: '1'.repeat(64), hashPath: '/fake/chromium',
  } satisfies VerifiedTool;
  await expect(runBrowserWorkerLane(browserBundle(), fakeChromium)).resolves.toMatchObject({
    lane: 'browser-worker-minified', status: 'unavailable', reason: 'playwright-not-provisioned',
  });
});
