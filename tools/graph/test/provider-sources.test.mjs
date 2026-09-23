import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph, loadTypeScript } from '../lib/extract.mjs';

for (const version of ['0-4', '0-5']) test(`extracts provider-source wrappers from ${version}`, () => {
  const file = resolve(import.meta.dirname, `fixtures/provider-sources-${version}.ts`);
  const root = resolve(import.meta.dirname, 'fixtures');
  const project = 'provider-sources-0-5.tsconfig.json';
  if (version === '0-5') {
    const { ts } = loadTypeScript(root);
    const config = ts.getParsedCommandLineOfConfigFile(resolve(root, project), {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
    });
    const flatten = diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    assert.deepEqual(config.errors.map(flatten), [], '0.5 fixture config diagnostics');
    const program = ts.createProgram(config.fileNames, config.options);
    assert.deepEqual(ts.getPreEmitDiagnostics(program).map(flatten), [], '0.5 fixture program diagnostics');
  }
  const graph = extractDependencyGraph(version === '0-5'
    ? { root, project }
    : { root, files: [file] });
  assert.equal(graph.units.length, 1);
  const [unit] = graph.units;
  assert.equal(unit.kind, 'bag');
  assert.equal(unit.file, `provider-sources-${version}.ts`);
  assert.match(unit.id, new RegExp(`^provider-sources-${version}\\.ts:[0-9]+$`));
  assert.deepEqual(unit.nodes.map(node => node.key), ['clock', 'config', 'stamp', 'client', 'db']);
  assert.equal(unit.nodes.find(node => node.key === 'stamp').async, true);
  assert.equal(unit.nodes.find(node => node.key === 'client').async, false);
  assert.deepEqual(unit.nodes.find(node => node.key === 'db').dependencies, ['config']);
  assert.equal(unit.nodes.find(node => node.key === 'db').async, true);
});
