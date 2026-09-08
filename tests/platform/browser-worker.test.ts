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
  packIsolatedClassic,
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

function browserBundle(source = 'minified-worker();'): BrowserBundle {
  const consumer = consumerFixture();
  const path = join(consumer, 'worker.js');
  const metafilePath = join(consumer, 'worker-meta.json');
  const bytes = Uint8Array.from(Buffer.from(source));
  const metafile = `${JSON.stringify(cleanMetafile(consumer))}\n`;
  writeFileSync(path, bytes);
  writeFileSync(metafilePath, metafile);
  return {
    path,
    sha256: sha256(bytes),
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
    gzipSha256: sha256(Uint8Array.from(gzipSync(bytes))),
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
    ['missing root', { inputs: { 'browser-entry.ts': {}, 'portable/contract.ts': {} }, outputs: cleanMetafile(consumer).outputs }, 'exactly one di-bag root entry'],
    ['node facade', { inputs: { ...cleanMetafile(consumer).inputs, 'node_modules/di-bag/dist/node.js': {} }, outputs: cleanMetafile(consumer).outputs }, 'node facade'],
    ['node builtin input', { inputs: { ...cleanMetafile(consumer).inputs, 'node:util/types': {} }, outputs: cleanMetafile(consumer).outputs }, 'node: input'],
    ['node builtin external import', { inputs: { ...cleanMetafile(consumer).inputs, 'browser-entry.ts': { imports: [{ path: 'node:fs', external: true }] } }, outputs: cleanMetafile(consumer).outputs }, 'node: input'],
    ['external node facade', { inputs: { ...cleanMetafile(consumer).inputs, 'browser-entry.ts': { imports: [{ path: 'di-bag/node', external: true }] } }, outputs: cleanMetafile(consumer).outputs }, 'external input'],
    ['external registry URL', { inputs: { ...cleanMetafile(consumer).inputs, 'browser-entry.ts': { imports: [{ path: 'https://registry.example/di-bag.js', external: true }] } }, outputs: cleanMetafile(consumer).outputs }, 'external input'],
    ['node builtin output import', { inputs: cleanMetafile(consumer).inputs, outputs: { 'worker.js': { imports: [{ path: 'node:path', external: true }] } } }, 'node: input'],
    ['foreign package input', { inputs: { ...cleanMetafile(consumer).inputs, 'node_modules/other/index.js': {} }, outputs: cleanMetafile(consumer).outputs }, 'outside the installed di-bag archive'],
    ['parent traversal', { inputs: { ...cleanMetafile(consumer).inputs, [`../${basename(consumer)}-foreign.ts`]: {} }, outputs: cleanMetafile(consumer).outputs }, 'outside the browser consumer'],
  ];
  for (const [name, metafile, message] of mutations) {
    expect(() => assertBrowserMetafile(metafile, consumer), name).toThrow(message);
  }

  symlinkSync('../../browser-entry.ts', join(consumer, 'node_modules/other/linked.js'));
  const disguisedForeign = cleanMetafile(consumer);
  disguisedForeign.inputs['node_modules/other/linked.js'] = {};
  expect(() => assertBrowserMetafile(disguisedForeign, consumer)).toThrow('outside the installed di-bag archive');

  mkdirSync(join(consumer, 'portable/node_modules/foreign'), { recursive: true });
  writeFileSync(join(consumer, 'portable/node_modules/foreign/index.js'), 'foreign\n');
  const nestedForeign = cleanMetafile(consumer);
  nestedForeign.inputs['portable/node_modules/foreign/index.js'] = {};
  expect(() => assertBrowserMetafile(nestedForeign, consumer)).toThrow('outside the installed di-bag archive');
  symlinkSync('node_modules/foreign/index.js', join(consumer, 'portable/foreign-link.js'));
  const disguisedNestedForeign = cleanMetafile(consumer);
  disguisedNestedForeign.inputs['portable/foreign-link.js'] = {};
  expect(() => assertBrowserMetafile(disguisedNestedForeign, consumer)).toThrow('outside the installed di-bag archive');

  expect(() => assertBrowserMetafile({ ...cleanMetafile(consumer), outputs: {} }, consumer))
    .toThrow('exactly one browser output');

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
    ['gzip hash', { ...bundle, gzipSha256: '0'.repeat(64) }, 'bundle gzip SHA-256 mismatch'],
    ['metafile hash', { ...bundle, metafileSha256: '0'.repeat(64) }, 'metafile SHA-256 mismatch'],
    ['root path', { ...bundle, resolvedDiBag: join(resolve(bundle.path, '..'), 'node_modules/di-bag/dist/internal.js') }, 'resolved di-bag root mismatch'],
  ];
  for (const [name, mutated, message] of cases) expect(() => validateBrowserBundle(mutated), name).toThrow(message);

  writeFileSync(bundle.path, 'changed');
  expect(() => validateBrowserBundle(bundle)).toThrow('bundle SHA-256 mismatch');

  const empty = browserBundle();
  writeFileSync(empty.path, '');
  expect(() => validateBrowserBundle({ ...empty, sha256: sha256(''), bytes: 0, gzipBytes: gzipSync('').length, gzipSha256: sha256(Uint8Array.from(gzipSync(''))) }))
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
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [{ lane: 'browser-worker-minified', result: portableResult, extra: 'noise' }] })).toEqual({ status: 'fail', reason: 'Worker message shape mismatch' });
  expect(evaluateBrowserWorkerProtocol({ ...clean, messages: [{ lane: 'browser-worker-minified', result: { ...portableResult, extra: undefined } }] })).toEqual({ status: 'fail', reason: 'Worker result mismatch' });
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
  const neverDriver: BrowserWorkerDriver = async (_bytes, _tool, signal) => new Promise(resolve => {
    signal.addEventListener('abort', () => resolve({ messages: [], errors: [], console: [], timedOut: true }), { once: true });
  });
  await expect(runBrowserWorkerLane(bundle, chromium, neverDriver, 10)).resolves.toMatchObject({ status: 'fail', reason: 'Worker timed out' });
  const rejectedDriver: BrowserWorkerDriver = async () => { throw new Error('browser setup failed'); };
  await expect(runBrowserWorkerLane(bundle, chromium, rejectedDriver, 10)).resolves.toMatchObject({ status: 'fail', reason: 'browser setup failed' });
});

test('explicitly unprovisioned browser tools stay unavailable without archive or bundle fallback', async () => {
  const esbuild = { status: 'unavailable', reason: 'not-provisioned' } as const;
  const chromium = { status: 'unavailable', reason: 'not-provisioned' } as const;
  const archive = { path: '/missing/archive.tgz', packageTree: '/missing/tree', sha256: '0'.repeat(64), files: [] } satisfies PackedArchive;
  await expect(bundleBrowserRoot(archive, esbuild)).rejects.toThrow('esbuild unavailable: not-provisioned');
  await expect(runBrowserWorkerLane(browserBundle(), chromium)).resolves.toMatchObject({
    lane: 'browser-worker-minified', status: 'unavailable', reason: 'not-provisioned',
  });

  const fakeChromium = {
    status: 'pinned', name: 'chromium', argv: ['/fake/chromium'], versionArgv: ['/fake/chromium', '--version'],
    version: '1', versionText: '1\n', sha256: '1'.repeat(64), hashPath: '/fake/chromium',
  } satisfies VerifiedTool;
  const unavailablePlaywright = { status: 'unavailable', reason: 'not-provisioned' } as const;
  await expect(runBrowserWorkerLane(browserBundle(), fakeChromium, undefined, 6_000, unavailablePlaywright)).resolves.toMatchObject({
    lane: 'browser-worker-minified', status: 'unavailable', reason: 'playwright-not-provisioned',
  });
  const stale = { ...browserBundle(), sha256: '0'.repeat(64) };
  await expect(runBrowserWorkerLane(stale, fakeChromium, undefined, 6_000, unavailablePlaywright)).resolves.toMatchObject({
    lane: 'browser-worker-minified', status: 'unavailable', reason: 'playwright-not-provisioned',
  });
});

test('provisioned browser tools execute the real packed archive lane', async () => {
  const root = resolve(__dirname, '../..');
  const [node, npm, classic6, esbuild, playwright, chromium] = await Promise.all([
    verifyTool(root, 'node'), verifyTool(root, 'npm'), verifyTool(root, 'classic6'),
    verifyTool(root, 'esbuild'), verifyTool(root, 'playwright'), verifyTool(root, 'chromium'),
  ]);
  const browserTools = [esbuild, playwright, chromium];
  if (browserTools.some(tool => tool.status === 'unavailable')) {
    expect(browserTools.filter(tool => tool.status === 'unavailable').length).toBeGreaterThan(0);
    return;
  }
  if (node.status === 'unavailable' || npm.status === 'unavailable' || classic6.status === 'unavailable') {
    throw new Error('foundation tools unavailable while browser tools are provisioned');
  }
  const archive = await packIsolatedClassic(root, node, npm, classic6);
  const bundle = await bundleBrowserRoot(archive, esbuild as VerifiedTool);
  try {
    await expect(runBrowserWorkerLane(bundle, chromium as VerifiedTool)).resolves.toMatchObject({
      lane: 'browser-worker-minified', status: 'pass',
    });
    const payload = JSON.stringify({ lane: 'browser-worker-minified', result: portableResult });
    const runtimeMutations: Array<[string, BrowserBundle, number, string]> = [
      ['duplicate', browserBundle(`postMessage(${payload});postMessage(${payload});`), 1_000, 'Worker posted extra messages'],
      ['error', browserBundle("throw new Error('worker exploded')"), 1_000, 'Worker error:'],
      ['console', browserBundle(`console.log('noise');postMessage(${payload});`), 1_000, 'Worker console output is not empty'],
      ['timeout', browserBundle('void 0;'), 100, 'Worker timed out'],
    ];
    for (const [name, mutated, timeoutMs, reason] of runtimeMutations) {
      await expect(runBrowserWorkerLane(mutated, chromium as VerifiedTool, undefined, timeoutMs), name)
        .resolves.toMatchObject({ status: 'fail', reason: expect.stringContaining(reason) });
    }
  } finally {
    rmSync(archive.packageTree, { recursive: true, force: true });
    rmSync(dirname(bundle.path), { recursive: true, force: true });
  }
}, 30_000);
