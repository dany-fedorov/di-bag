import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Application } from 'typedoc';
import { verifyApiCoverage } from '../lib/coverage.mjs';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(directory, '../..');
const app = await Application.bootstrapWithPlugins({ options: resolve(directory, 'typedoc.json') });
const project = await app.convert();
assert(project);
const output = resolve(root, 'docs/reference');

test('coverage includes standalone adapter overloads and type-only callables', () => {
  const report = verifyApiCoverage(project, root, output);
  assert.equal(report.callableOverloads['val-box.fromValBox'], 2);
  assert.equal(report.callableOverloads['val-box.fromValBoxAsync'], 2);
  assert.equal(report.callableOverloads['sas-box.fromSasBox'], 1);
  assert.equal(report.callableOverloads['index.fromPlugin'], 1);
  assert.equal(report.callableOverloads['index.DiBagCleanupError.constructor'], 1);
});

test('coverage rejects a generator that silently drops a public export', () => {
  const module = project.children.find(child => child.name === 'index');
  const children = module.children;
  try {
    module.children = children.filter(child => child.name !== 'Token');
    assert.throws(() => verifyApiCoverage(project, root, output), /generated exports differ/);
  } finally { module.children = children; }
});

test('coverage rejects missing overloads even when the exported name survives', () => {
  const module = project.children.find(child => child.name === 'val-box');
  const adapter = module.children.find(child => child.name === 'fromValBox');
  const signatures = adapter.signatures;
  try {
    adapter.signatures = signatures.slice(0, 1);
    assert.throws(() => verifyApiCoverage(project, root, output), /fromValBox: overload count differs/);
  } finally { adapter.signatures = signatures; }
});
