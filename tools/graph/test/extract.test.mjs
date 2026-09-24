// tools/graph/test/extract.test.mjs
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph, loadTypeScript } from '../lib/extract.mjs';

const root = resolve(import.meta.dirname, '../../..');
const fixture = resolve(root, 'tools/graph/test/fixtures/split-builder.ts');
const graph = extractDependencyGraph({ project: 'tools/graph/test/fixtures/split-builder.tsconfig.json', root });
const unit = id => graph.units.find(candidate => candidate.id === id);

function resolvedSymbol(checker, node) {
  const symbol = checker.getSymbolAtLocation(node);
  return symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function exportedOwners(checker, sourceFile, specifier) {
  const imported = sourceFile.statements.find(statement => ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === specifier);
  assert.ok(imported, `missing ${specifier} import`);
  const moduleSymbol = resolvedSymbol(checker, imported.moduleSpecifier);
  return new Map(checker.getExportsOfModule(moduleSymbol).flatMap(exported => {
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    if (!['Provider', 'DiBagApi'].includes(symbol.name)) return [];
    const declaredOwner = (symbol.declarations ?? []).some(declaration =>
      (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration))
      && declaration.name?.text === symbol.name);
    return declaredOwner ? [[symbol.name, symbol]] : [];
  }));
}

const ts = loadTypeScript(root).ts;

function declarationOwnerFixture() {
  const configPath = resolve(root, 'tools/graph/test/fixtures/provider-facades.tsconfig.json');
  const config = ts.getParsedCommandLineOfConfigFile(configPath, {}, ts.sys);
  const legacyPath = resolve(root, 'tools/graph/test/fixtures/provider-methods-0-4.ts');
  const program = ts.createProgram([...config.fileNames, legacyPath], { ...config.options, noEmit: true });
  const checker = program.getTypeChecker();
  const finalSource = program.getSourceFile(resolve(root, 'tools/graph/test/fixtures/provider-facades.ts'));
  const legacySource = program.getSourceFile(legacyPath);
  assert.ok(finalSource);
  assert.ok(legacySource);
  const localLookalikes = new Map(finalSource.statements.flatMap(statement =>
    ts.isClassDeclaration(statement) && ['Provider', 'DiBagApi'].includes(statement.name?.text)
      ? [[statement.name.text, resolvedSymbol(checker, statement.name)]] : []));
  return {
    finalOwners: exportedOwners(checker, finalSource, 'di-bag'),
    vendoredOwners: exportedOwners(checker, legacySource, './provider-sources-0-4-library.js'),
    localLookalikes,
  };
}

test('every builder chain becomes a unit in source order with its kind and exports', () => {
  assert.deepEqual(graph.units.map(candidate => [candidate.kind, candidate.exports]), [
    ['module', ['retrieve']], ['bag', []], ['bag', []],
  ]);
  assert.equal(graph.units[0].file, 'tools/graph/test/fixtures/split-builder.ts');
  assert.equal(graph.units[0].line, 4);
  assert.equal(graph.units[2].line, 20);
  assert.deepEqual(graph.units[0].requirements, ['search']);
  assert.equal(graph.units[1].requirements, undefined);
});

test('a chain continued from a partial builder collects every registration', () => {
  const app = graph.units[1];
  assert.deepEqual(app.nodes.map(node => node.key), ['search', 'run', 'db']);
  assert.deepEqual(app.installs, [graph.units[0].id]);
  const db = app.nodes.find(node => node.key === 'db');
  assert.deepEqual(db, { key: 'db', line: 15, dependencies: ['search'], async: true, lifetime: 'singleton:one-per-container-tree', owned: true });
  assert.deepEqual(app.edges, [{ from: 'db', to: 'search' }, { from: 'run', to: 'retrieve' }]);
});

test('declared dependencies come from the factory parameter type', () => {
  const retrieve = graph.units[0].nodes.find(node => node.key === 'retrieve');
  assert.deepEqual(retrieve.dependencies, ['search', 'normalize']);
  assert.equal(retrieve.async, false);
  assert.equal(retrieve.lifetime, 'scoped:one-per-container');
});

test('cycles and unresolved names are reported as issues', () => {
  const cyclic = graph.units[2];
  assert.deepEqual(graph.issues.filter(issue => issue.unit === cyclic.id), [
    { kind: 'cycle', unit: cyclic.id, path: ['a', 'b', 'a'] },
    { kind: 'unresolved', unit: cyclic.id, consumer: 'lonely', dependency: 'missing' },
  ]);
  // `run` depends on `retrieve`, which an installed module exports: resolved, not an issue.
  assert.equal(graph.issues.some(issue => issue.unit === graph.units[1].id), false);
});

test('build() is still the end of the chain when ensureServicesReady follows it', () => {
  const ready = extractDependencyGraph({ files: [resolve(root, 'tools/graph/test/fixtures/ready-chain.ts')], root });
  assert.deepEqual(ready.units.map(candidate => [candidate.kind, candidate.nodes.map(node => node.key)]), [['bag', ['db', 'report']]]);
  assert.deepEqual(ready.units[0].edges, [{ from: 'report', to: 'db' }]);
  assert.deepEqual(ready.issues, []);
});

test('provider facades are unwrapped only through the exported DiBagApi declaration owner', () => {
  const { finalOwners, vendoredOwners, localLookalikes } = declarationOwnerFixture();
  assert.deepEqual([...finalOwners.keys()].sort(), ['DiBagApi', 'Provider']);
  assert.deepEqual([...vendoredOwners.keys()].sort(), ['DiBagApi', 'Provider']);
  assert.deepEqual([...localLookalikes.keys()].sort(), ['DiBagApi', 'Provider']);
  assert.notEqual(finalOwners.get('DiBagApi'), vendoredOwners.get('DiBagApi'));
  assert.notEqual(finalOwners.get('Provider'), vendoredOwners.get('Provider'));
  for (const local of localLookalikes.values()) {
    assert.equal([...finalOwners.values()].includes(local), false);
    assert.equal([...vendoredOwners.values()].includes(local), false);
  }
  const providers = extractDependencyGraph({ project: 'tools/graph/test/fixtures/provider-facades.tsconfig.json', root });
  assert.equal(providers.units.length, 1);
  assert.deepEqual(providers.units[0].nodes.map(({ key, lifetime, owned }) => ({ key, lifetime, owned })), [
    { key: 'singleton', lifetime: 'singleton:one-per-container-tree', owned: true },
    { key: 'scoped', lifetime: 'scoped:one-per-container', owned: false },
    { key: 'transient', lifetime: 'transient:one-per-resolve', owned: true },
    { key: 'dynamic', lifetime: 'dynamic', owned: false },
    { key: 'reset', lifetime: 'scoped:one-per-container', owned: false },
    { key: 'localProvider', lifetime: 'scoped:one-per-container', owned: false },
    { key: 'localObject', lifetime: 'scoped:one-per-container', owned: false },
  ]);
});

test('shorthand provider bags retain the same outer lifetime and nested ownership as explicit bags', () => {
  const providers = extractDependencyGraph({ project: 'tools/graph/test/fixtures/provider-shorthand.tsconfig.json', root });
  assert.equal(providers.units.length, 1);
  assert.deepEqual(providers.units[0].nodes.map(({ key, lifetime, owned }) => ({ key, lifetime, owned })), [
    { key: 'explicitProvider', lifetime: 'singleton:one-per-container-tree', owned: true },
    { key: 'shorthandProvider', lifetime: 'singleton:one-per-container-tree', owned: true },
  ]);
});

test('vendored 0.4 wrappers retain their independent declaration-owner recognition', () => {
  const legacy = extractDependencyGraph({ files: [resolve(root, 'tools/graph/test/fixtures/provider-methods-0-4.ts')], root });
  assert.equal(legacy.units.length, 1);
  assert.deepEqual(legacy.units[0].nodes.map(({ key, lifetime, owned }) => ({ key, lifetime, owned })), [
    { key: 'legacy', lifetime: 'singleton:one-per-container-tree', owned: true },
    { key: 'derivedLegacy', lifetime: 'transient:one-per-resolve', owned: true },
  ]);
});
