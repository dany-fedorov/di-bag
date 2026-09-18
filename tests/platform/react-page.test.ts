import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  assertReactMetafile,
  bundleReactEntry,
  evaluateReactPageProtocol,
  expectedReactReport,
  installedReactVersion,
  laneName,
  runReactPageLane,
  type ReactBundle,
  type ReactPageDriver,
  type ReactPageTranscript,
} from '../../scripts/react-browser-lane';
import { verifyTool, type VerifiedTool } from '../../scripts/platform-evidence';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const react = installedReactVersion();
const fakeChromium = {
  status: 'pinned', name: 'chromium', argv: ['/fake/chromium'], versionArgv: ['/fake/chromium', '--version'],
  version: '1', versionText: '1\n', sha256: '1'.repeat(64), hashPath: '/fake/chromium',
} satisfies VerifiedTool;

function fakeBundle(source = 'void 0;', mode: 'development' | 'production' = 'development'): ReactBundle {
  const directory = mkdtempSync(join(tmpdir(), 'di-bag-react-test-'));
  roots.push(directory);
  const path = join(directory, 'bundle.js');
  const bytes = Uint8Array.from(Buffer.from(source));
  writeFileSync(path, bytes);
  const metafilePath = join(directory, 'bundle-meta.json');
  writeFileSync(metafilePath, '{"inputs":{},"outputs":{"bundle.js":{}}}\n');
  return { mode, path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, metafilePath, react };
}

function transcript(overrides: Partial<ReactPageTranscript> = {}): ReactPageTranscript {
  return { reports: [expectedReactReport('development', react)], errors: [], console: [], timedOut: false, ...overrides };
}

const cleanMetafile = {
  inputs: {
    'examples/react/browser-scenario.tsx': { imports: [{ path: 'src/index.ts', kind: 'import-statement' }, { path: 'node_modules/react/index.js', kind: 'import-statement' }] },
    'src/index.ts': { imports: [] },
    'node_modules/react/index.js': { imports: [{ path: 'node_modules/react/cjs/react.development.js', kind: 'require-call' }] },
    'node_modules/react/cjs/react.development.js': { imports: [] },
    'node_modules/react-dom/client.js': { imports: [] },
    'node_modules/scheduler/index.js': { imports: [] },
  },
  outputs: { 'bundle.js': { imports: [] } },
};

test('react metafile accepts src, the example, and the React packages only', () => {
  expect(() => assertReactMetafile(cleanMetafile)).not.toThrow();
  const mutations: Array<[string, unknown, string]> = [
    ['node builtin input', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'node:fs': {} } }, 'node: input'],
    ['node facade', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'src/node.ts': {} } }, 'node facade'],
    ['foreign package', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'node_modules/lodash/index.js': {} } }, 'outside the allowed roots'],
    ['other example', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'examples/scopes.ts': {} } }, 'outside the allowed roots'],
    ['parent traversal', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, '../elsewhere/x.js': {} } }, 'outside the repository'],
    ['absolute path', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, '/tmp/x.js': {} } }, 'outside the repository'],
    ['external import', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'src/index.ts': { imports: [{ path: 'https://cdn.example/react.js', external: true }] } } }, 'external input'],
    ['node import', { ...cleanMetafile, inputs: { ...cleanMetafile.inputs, 'src/index.ts': { imports: [{ path: 'node:util/types', external: true }] } } }, 'node: input'],
    ['two outputs', { ...cleanMetafile, outputs: { 'a.js': {}, 'b.js': {} } }, 'exactly one output'],
    ['malformed', { inputs: [] }, 'invalid esbuild metafile'],
  ];
  for (const [name, metafile, message] of mutations) expect(() => assertReactMetafile(metafile), name).toThrow(message);
});

test('page protocol accepts exactly one matching report and rejects everything else', () => {
  const expected = expectedReactReport('development', react);
  expect(evaluateReactPageProtocol(transcript(), expected)).toEqual({ status: 'pass' });
  expect(evaluateReactPageProtocol(transcript({ reports: [] }), expected)).toEqual({ status: 'fail', reason: 'page posted no report' });
  expect(evaluateReactPageProtocol(transcript({ reports: [expected, expected] }), expected)).toEqual({ status: 'fail', reason: 'page posted extra reports' });
  expect(evaluateReactPageProtocol(transcript({ reports: [{ ...expected, mounted: { ...expected.mounted, generation: 7 } }] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ reports: [expectedReactReport('production', react)] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ reports: [{ ...expected, closed: { ...expected.closed, unhandled: ['boom'] } }] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ reports: [{ ...expected, unmountDuringStartup: { ...expected.unmountDuringStartup, published: true } }] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
  expect(evaluateReactPageProtocol(transcript({ errors: ['Uncaught TypeError'] }), expected)).toEqual({ status: 'fail', reason: 'page error: Uncaught TypeError' });
  expect(evaluateReactPageProtocol(transcript({ console: [{ type: 'error', text: 'Each child in a list should have a unique "key" prop.' }] }), expected)).toEqual({ status: 'fail', reason: 'page console error: Each child in a list should have a unique "key" prop.' });
  expect(evaluateReactPageProtocol(transcript({ console: [{ type: 'warning', text: 'deprecated' }] }), expected)).toEqual({ status: 'fail', reason: 'page console warning: deprecated' });
  expect(evaluateReactPageProtocol(transcript({ console: [{ type: 'info', text: 'Download the React DevTools' }] }), expected)).toEqual({ status: 'pass' });
  expect(evaluateReactPageProtocol(transcript({ timedOut: true }), expected)).toEqual({ status: 'fail', reason: 'page timed out' });
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  expect(evaluateReactPageProtocol(transcript({ reports: [cyclic] }), expected)).toEqual({ status: 'fail', reason: 'page report mismatch' });
});

test('development and production expect the same scenario except the Strict Mode generation', () => {
  const development = expectedReactReport('development', react);
  const production = expectedReactReport('production', react);
  expect(development.lane).toBe('react-page-development');
  expect(production.lane).toBe('react-page-production');
  expect(development.mounted.generation).toBe(2);
  expect(production.mounted.generation).toBe(1);
  expect({ ...development, lane: '', mounted: { ...development.mounted, generation: 0 } })
    .toEqual({ ...production, lane: '', mounted: { ...production.mounted, generation: 0 } });
  expect(development.unmountDuringStartup).toEqual({
    state: 'idle', gammaCalls: 1, published: false,
    lockEvents: ['acquire:alpha', 'release:alpha', 'acquire:beta', 'release:beta', 'acquire:broken', 'release:broken', 'acquire:alpha', 'release:alpha', 'acquire:gamma', 'release:gamma'],
  });
  expect(development.closed).toEqual({ transportCloses: 1, failures: [], unhandled: [] });
});

test('react page lane rechecks the bundle and maps driver outcomes', async () => {
  const bundle = fakeBundle();
  const pass: ReactPageDriver = async () => transcript();
  await expect(runReactPageLane(bundle, fakeChromium, pass)).resolves.toMatchObject({ status: 'pass', lane: 'react-page-development', react, mode: 'development' });
  await expect(runReactPageLane({ ...bundle, sha256: '0'.repeat(64) }, fakeChromium, pass)).resolves.toMatchObject({ status: 'fail', reason: 'react bundle SHA-256 mismatch' });
  const errorDriver: ReactPageDriver = async () => transcript({ errors: ['scenario exploded'] });
  await expect(runReactPageLane(bundle, fakeChromium, errorDriver)).resolves.toMatchObject({ status: 'fail', reason: 'page error: scenario exploded' });
  const consoleDriver: ReactPageDriver = async () => transcript({ console: [{ type: 'error', text: 'act warning' }] });
  await expect(runReactPageLane(bundle, fakeChromium, consoleDriver)).resolves.toMatchObject({ status: 'fail', reason: 'page console error: act warning' });
  const neverDriver: ReactPageDriver = async (_bytes, _tool, signal) => new Promise(resolveTranscript => {
    signal.addEventListener('abort', () => resolveTranscript(transcript({ timedOut: true })), { once: true });
  });
  await expect(runReactPageLane(bundle, fakeChromium, neverDriver, 10)).resolves.toMatchObject({ status: 'fail', reason: 'page timed out' });
  const throwingDriver: ReactPageDriver = async () => { throw new Error('browser setup failed'); };
  await expect(runReactPageLane(bundle, fakeChromium, throwingDriver)).resolves.toMatchObject({ status: 'fail', reason: 'browser setup failed' });
  await expect(runReactPageLane(bundle, { status: 'unavailable', reason: 'not-provisioned' })).resolves.toMatchObject({ status: 'unavailable', reason: 'not-provisioned' });
  await expect(runReactPageLane(bundle, fakeChromium, undefined, 6_000, { status: 'unavailable', reason: 'not-provisioned' })).resolves.toMatchObject({ status: 'unavailable', reason: 'playwright-not-provisioned' });
});

test('provisioned browser tools run the React scenario in development and production builds', async () => {
  const root = resolve(__dirname, '../..');
  const [esbuild, playwright, chromium] = await Promise.all([verifyTool(root, 'esbuild'), verifyTool(root, 'playwright'), verifyTool(root, 'chromium')]);
  const tools = [esbuild, playwright, chromium];
  if (tools.some(tool => tool.status === 'unavailable')) {
    // The portable CI job provisions them and runs `npm run check:react-browser` as the required gate.
    expect(tools.filter(tool => tool.status === 'unavailable').length).toBeGreaterThan(0);
    return;
  }
  for (const mode of ['development', 'production'] as const) {
    const bundle = bundleReactEntry(esbuild as VerifiedTool, mode);
    try {
      const row = await runReactPageLane(bundle, chromium as VerifiedTool);
      expect(row, mode).toMatchObject({ lane: laneName(mode), status: 'pass', react });
    } finally {
      rmSync(dirname(bundle.path), { recursive: true, force: true });
    }
  }
}, 120_000);
