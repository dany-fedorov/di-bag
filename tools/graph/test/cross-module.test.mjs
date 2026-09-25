// tools/graph/test/cross-module.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph, loadTypeScript } from '../lib/extract.mjs';

const root = resolve(import.meta.dirname, '../../..');
const directory = 'tools/graph/test/fixtures/cross-module';
const graph = extractDependencyGraph({ files: [`${directory}/app.ts`], root });
const idOf = (file, text) => `${directory}/${file}:${readFileSync(resolve(root, directory, file), 'utf8').split('\n').findIndex(line => line.includes(text)) + 1}`;
const issuesOf = id => graph.issues.filter(issue => issue.unit === id);

test('installs imported from other files resolve to their module units', () => {
  const app = graph.units.find(unit => unit.id === idOf('app.ts', 'export const cyclic'));
  assert.deepEqual(app.installs, [idOf('billing.ts', 'export const billingModule'), idOf('shipping.ts', 'export const shippingModule')]);
});

test('a cycle spanning two installed modules is reported on the host with labeled private nodes', () => {
  assert.deepEqual(issuesOf(idOf('app.ts', 'export const cyclic')), [{
    kind: 'cycle', unit: idOf('app.ts', 'export const cyclic'),
    path: ['billingModule/ledger', 'shippingModule/shipping', 'shippingModule/carrier', 'billingModule/billing', 'billingModule/ledger'],
  }]);
  assert.deepEqual(issuesOf(idOf('billing.ts', 'export const billingModule')), []);
  assert.deepEqual(graph.units.find(unit => unit.id === idOf('billing.ts', 'export const billingModule')).requirements, ['shipping']);
});

test('a requirement no host supplies is unresolved on the host', () => {
  assert.deepEqual(issuesOf(idOf('app.ts', 'export const missing')), [
    { kind: 'unresolved', unit: idOf('app.ts', 'export const missing'), consumer: 'billingModule/ledger', dependency: 'shipping' },
  ]);
});

test('renamed exports resolve and untraceable installs suppress unresolved names', () => {
  assert.deepEqual(issuesOf(idOf('app.ts', 'export const renamed')), []);
  const opaque = idOf('app.ts', 'export const opaque');
  assert.deepEqual(issuesOf(opaque), []);
  assert.deepEqual(graph.units.find(unit => unit.id === opaque).installs, ['makeModule()']);
});

test('a cycle inside one module is reported once, on the module', () => {
  const loop = idOf('parts.ts', 'export const loopModule');
  assert.deepEqual(graph.issues.filter(issue => issue.kind === 'cycle' && issue.path.includes('x')), [{ kind: 'cycle', unit: loop, path: ['x', 'y', 'x'] }]);
  assert.deepEqual(issuesOf(idOf('app.ts', 'export const hostOfLoop')), []);
});

test('a module label from buildModule options names its private nodes, as runtime messages do', () => {
  const module = graph.units.find(unit => unit.id === idOf('parts.ts', 'export const labeledModule'));
  assert.equal(module.label, 'orders');
  const host = idOf('app.ts', 'export const labeledHost');
  assert.deepEqual(issuesOf(host), [{ kind: 'unresolved', unit: host, consumer: 'orders/inner', dependency: 'outerNeed' }]);
});

test('loadTypeScript uses the project compiler only when it has the compiler API at 6.0.3 or later', () => {
  // One directory per case: require caches a module by path.
  const base = mkdtempSync(join(tmpdir(), 'di-bag-graph-ts-'));
  const project = version => {
    const directory = join(base, version ?? 'none');
    mkdirSync(join(directory, 'node_modules/typescript'), { recursive: true });
    if (version) {
      writeFileSync(join(directory, 'node_modules/typescript/package.json'), JSON.stringify({ name: 'typescript', version, main: 'index.js' }));
      // TypeScript 7 exposes no createProgram.
      writeFileSync(join(directory, 'node_modules/typescript/index.js'), `module.exports = { version: '${version}'${version.startsWith('7') ? '' : ', createProgram() {}'} };`);
    }
    return directory;
  };
  try {
    assert.equal(loadTypeScript(project()).source, 'bundled');
    assert.deepEqual(loadTypeScript(project('6.0.3')), { ts: loadTypeScript(project('6.0.3')).ts, version: '6.0.3', source: 'project' });
    assert.equal(loadTypeScript(project('6.0.2')).source, 'bundled');
    assert.equal(loadTypeScript(project('7.0.2')).source, 'bundled');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('literal requirement renames satisfy static cross-module edges', () => {
  for (const name of ['renamedRequirement', 'repeatedRequirement', 'exportFirstRequirement', 'requirementFirstExport', 'nestedRequirementHost']) {
    const id = idOf('app.ts', `export const ${name} =`);
    const unit = graph.units.find(candidate => candidate.id === id);
    assert(unit, `missing extracted host ${name}`);
    assert.deepEqual(unit.installs, [name === 'nestedRequirementHost'
      ? idOf('app.ts', 'const nestedRequirementModule =')
      : idOf('billing.ts', 'export const billingModule')], name);
    assert.deepEqual(issuesOf(id), [], name);
  }
});

test('dynamic requirement names and bags remain opaque', () => {
  for (const name of ['dynamicRequirement', 'dynamicRequirementBag']) {
    const id = idOf('app.ts', `export const ${name} =`);
    const unit = graph.units.find(candidate => candidate.id === id);
    assert(unit, `missing extracted host ${name}`);
    assert(unit.installs.some(value => value.includes('withRenamedRequirement')), name);
    assert.deepEqual(issuesOf(id), [], name);
  }
});

test('module requirements expose names at each installation boundary', () => {
  const cases = [
    ['billing.ts', 'export const billingModule', ['shipping']],
    ['app.ts', 'const nestedRequirementModule =', ['delivery']],
    ['app.ts', 'const repeatedRequirementModule =', ['transport']],
    ['app.ts', 'const nestedTransportModule =', ['transport']],
    ['app.ts', 'const emptyRequirementModule =', ['']],
  ];
  for (const [file, declaration, requirements] of cases) {
    const id = idOf(file, declaration);
    const unit = graph.units.find(candidate => candidate.id === id);
    assert(unit, declaration);
    assert.deepEqual(unit.requirements, requirements, declaration);
  }
  for (const name of ['repeatedModuleHost', 'nestedTransportHost', 'emptyRequirementHost']) {
    assert.deepEqual(issuesOf(idOf('app.ts', `export const ${name} =`)), [], name);
  }
});

test('a missing renamed host keeps the factory dependency name and labeled consumer', () => {
  for (const [name, consumer] of [
    ['missingRenamedRequirement', 'billingModule/ledger'],
    ['missingNestedRequirement', 'nestedRequirementModule/billingModule/ledger'],
  ]) {
    const id = idOf('app.ts', `export const ${name} =`);
    assert.deepEqual(issuesOf(id), [
      { kind: 'unresolved', unit: id, consumer, dependency: 'shipping' },
    ], name);
  }
});

test('an opaque nested installation publishes no requirements or issues', () => {
  const module = graph.units.find(unit => unit.id === idOf('app.ts', 'const opaqueRequirementModule ='));
  assert.deepEqual(module.requirements, []);
  assert.deepEqual(issuesOf(idOf('app.ts', 'export const opaqueNestedRequirement =')), []);
});

test('mixed export and requirement views supply invoice to consumers', () => {
  for (const name of ['exportFirstRequirement', 'requirementFirstExport']) {
    const id = idOf('app.ts', `export const ${name} =`);
    const unit = graph.units.find(candidate => candidate.id === id);
    assert.deepEqual(unit.edges.filter(edge => edge.from === 'invoiceReport'), [{ from: 'invoiceReport', to: 'invoice' }], name);
    assert.deepEqual(issuesOf(id), [], name);
  }
});
