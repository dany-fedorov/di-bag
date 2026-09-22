// tools/codemod/test/transforms.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { defaultMapFile, runCodemod, transforms, validateRenameMap } from '../lib/codemod.mjs';
import { compiler, fixturesProgram, fixturesRoot } from './helpers.mjs';

test('every transform the shipped map names exists in the registry', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  assert.deepEqual(validateRenameMap(shipped, Object.keys(transforms)), []);
  assert.deepEqual(Object.keys(transforms), ['build-and-start', 'collection-read', 'collection-reference', 'collection-token']);
});

test('a map that names an unknown transform is refused before any file is read', () => {
  const map = { version: 1, methods: [{ owner: 'Builder', from: 'build', to: 'buildContainer', transform: 'absent' }] };
  assert.throws(() => runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), map }), /unknown transform absent/);
});

test('a transform asks the map for the names it emits', () => {
  const shipped = JSON.parse(readFileSync(defaultMapFile, 'utf8'));
  const map = {
    ...shipped,
    methods: [
      ...shipped.methods.map(entry => entry.owner === 'Builder' && entry.from === 'buildAndStart'
        ? { ...entry, transformNames: { concurrency: 'capacity limit' } }
        : entry),
      { owner: 'Builder', from: 'build', to: 'buildContainer' },
    ],
    properties: shipped.properties.map(entry => entry.owner !== 'StartupOptions' ? entry
      : entry.from === 'signal' ? { ...entry, to: 'cancellation' }
      : entry.from === 'timeoutMs' ? { ...entry, to: 'deadline' }
      : entry),
  };
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), only: ['build-and-start/input.ts'], map });
  assert.match(result.files[0].text, /builder\.buildContainer\(\)\.ensureServicesReady\(\['db'\]\);/);
  assert.doesNotMatch(result.files[0].text, /\.build\(\)/);
  assert.match(result.files[0].text, /\{ cancellation: shutdown, deadline: 5_000, "capacity limit": 1 \}/);
});

test('an undecidable custom transform leaves each whole call untouched and reports it', () => {
  const result = runCodemod({ typescript: compiler.ts, root: fixturesRoot, program: fixturesProgram(), only: ['build-and-start/input.ts'] });
  const text = result.files[0].text;
  assert.match(text, /builder\.buildAndStart\(\['db'\], \{ signal: shutdown as StartupOptions\['signal'\], timeoutMs: 3_000, startupOrder: order \}\)/);
  assert.match(text, /builder\.buildAndStart\(\['db'\], \{ timeoutMs: 3_000, \.\.\.spreadOptions \}\)/);
  assert.match(text, /builder\.buildAndStart\(\.\.\.\(\[\['db'\], \{ startupOrder: 'parallel' \}\] as \[readonly \['db'\], StartupOptions\]\)\)/);
  assert.ok(result.manual.some(item => item.reason.startsWith('startupOrder is not a literal')));
  assert.ok(result.manual.some(item => item.reason.startsWith('options are spread here')));
  assert.ok(result.manual.some(item => item.reason.startsWith('buildAndStart is called with a spread argument')));
});
