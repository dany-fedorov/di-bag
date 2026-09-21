// tools/codemod/test/glob.test.mjs
import assert from 'node:assert/strict';
import { relative, resolve } from 'node:path';
import { test } from 'node:test';
import { expandGlob } from '../lib/glob.mjs';

const root = resolve(import.meta.dirname, 'library-root-fixture');
const names = pattern => expandGlob(pattern, root).map(file => relative(root, file).replaceAll('\\', '/'));

test('a star stays inside one directory and two stars cross directories', () => {
  assert.deepEqual(names('app/*.ts'), ['app/main.ts']);
  assert.deepEqual(names('app/**/*.ts'), ['app/excluded/extra.ts', 'app/main.ts']);
  assert.deepEqual(names('**/extra.ts'), ['app/excluded/extra.ts']);
});

test('a plain path names one file, and a missing one names none', () => {
  assert.deepEqual(names('app/main.ts'), ['app/main.ts']);
  assert.deepEqual(names('app/absent.ts'), []);
  assert.deepEqual(names('absent/*.ts'), []);
});
