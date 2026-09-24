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

test('coverage includes final provider-facade overloads and type-only callables', () => {
  const report = verifyApiCoverage(project, root, output);
  assert.equal(report.callableOverloads['index.DiBagApi.providerWithDisposal'], 1);
  assert.equal(report.callableOverloads['index.DiBagApi.providerWithLifetime'], 1);
  assert.equal(report.callableOverloads['index.DiBagApi.providerWithRegistrationMetadata'], 1);
  assert.equal(report.callableOverloads['index.DiBagApi.providerWithAcquisitionMetadata'], 2);
  assert.equal(report.callableOverloads['index.DiBagApi.providerWithTransformedService'], 2);
  assert.equal(report.callableOverloads['index.CreateProviderFromPlugin'], 1);
  assert.equal(report.callableOverloads['index.PluginProviderFactory'], undefined);
  assert.equal(report.callableOverloads['index.DiBagApi.createProvider'], 2);
  assert.equal(report.callableOverloads['index.DiBagApi.createProviderFromFunction'], 1);
  assert.equal(report.callableOverloads['index.DiBagApi.createProviderFromClass'], 1);
  assert.equal(report.callableOverloads['index.DiBagApi.createProviderFromPlugin'], 1);
  assert.equal(report.callableOverloads['index.DiBagApi.createToken'], 1);
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
  const module = project.children.find(child => child.name === 'index');
  const facade = module.children.find(child => child.name === 'DiBagApi');
  const decorator = facade.children.find(child => child.name === 'providerWithAcquisitionMetadata');
  const signatures = decorator.signatures;
  try {
    decorator.signatures = [];
    assert.throws(() => verifyApiCoverage(project, root, output), /providerWithAcquisitionMetadata: overload count differs/);
  } finally { decorator.signatures = signatures; }
});
