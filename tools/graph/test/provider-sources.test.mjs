import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph, loadTypeScript } from '../lib/extract.mjs';

test('extracts provider-source wrappers from 0.5', () => {
  const root = resolve(import.meta.dirname, 'fixtures');
  const project = 'provider-sources-0-5.tsconfig.json';
  const { ts } = loadTypeScript(root);
  const config = ts.getParsedCommandLineOfConfigFile(resolve(root, project), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
  });
  const flatten = diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  assert.deepEqual(config.errors.map(flatten), [], '0.5 fixture config diagnostics');
  const program = ts.createProgram(config.fileNames, config.options);
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(flatten), [], '0.5 fixture program diagnostics');
  const graph = extractDependencyGraph({ root, project });
  assert.equal(graph.units.length, 1);
  const [unit] = graph.units;
  assert.equal(unit.kind, 'bag');
  assert.equal(unit.file, 'provider-sources-0-5.ts');
  assert.match(unit.id, /^provider-sources-0-5\.ts:[0-9]+$/);
  assert.deepEqual(unit.nodes.map(node => node.key), ['clock', 'config', 'stamp', 'client', 'db']);
  assert.equal(unit.nodes.find(node => node.key === 'stamp').async, true);
  assert.equal(unit.nodes.find(node => node.key === 'client').async, false);
  assert.deepEqual(unit.nodes.find(node => node.key === 'db').dependencies, ['config']);
  assert.equal(unit.nodes.find(node => node.key === 'db').async, true);
});
