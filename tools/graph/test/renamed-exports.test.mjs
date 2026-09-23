import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { extractDependencyGraph } from '../lib/extract.mjs';

test('literal renamed-export bags compose in order while uncertain bags remain opaque', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-graph-renames-'));
  const file = join(root, 'graph.ts');
  writeFileSync(file, `
declare const DiBag: any;
const clockModule = DiBag.createBuilder()
  .withServices({ clock: () => 1 })
  .buildModule({ exportedServiceKeys: ['clock'] });
const renameOptions = { currentExportKey: 'clock', newExportKey: 'namedClock' } as const;
const spread = { newExportKey: 'spreadClock' } as const;
const currentExportKey = 'clock' as const;
const newExportKey = 'shorthandClock' as const;
declare const dynamicCurrentExportKey: string;
export const resolved = DiBag.createBuilder()
  .withInstalledModules([clockModule
    .renameExport('clock', 'time')
    .withRenamedExport({ currentExportKey: 'time', newExportKey: 'now' })])
  .withServices({ resolvedReport: ({ now }: { now: number }) => now })
  .buildContainer();
export const identityHost = DiBag.createBuilder()
  .withInstalledModules([clockModule.withRenamedExport({ currentExportKey: 'clock', newExportKey: 'clock' })])
  .withServices({ identityReport: ({ clock }: { clock: number }) => clock })
  .buildContainer();
export const spreadHost = DiBag.createBuilder()
  .withInstalledModules([clockModule.withRenamedExport({ currentExportKey: 'clock', ...spread })])
  .withServices({ spreadReport: ({ anything }: { anything: number }) => anything })
  .buildContainer();
export const namedHost = DiBag.createBuilder()
  .withInstalledModules([clockModule.withRenamedExport(renameOptions)])
  .withServices({ namedReport: ({ anything }: { anything: number }) => anything })
  .buildContainer();
export const shorthandHost = DiBag.createBuilder()
  .withInstalledModules([clockModule.withRenamedExport({ currentExportKey, newExportKey })])
  .withServices({ shorthandReport: ({ anything }: { anything: number }) => anything })
  .buildContainer();
export const unknownValueHost = DiBag.createBuilder()
  .withInstalledModules([clockModule.withRenamedExport({ currentExportKey: dynamicCurrentExportKey, newExportKey: 'dynamicClock' })])
  .withServices({ unknownValueReport: ({ anything }: { anything: number }) => anything })
  .buildContainer();
`);
  try {
    const graph = extractDependencyGraph({ files: [file], root });
    const module = graph.units.find(unit => unit.kind === 'module');
    const resolved = graph.units.find(unit => unit.nodes.some(node => node.key === 'resolvedReport'));
    const identityHost = graph.units.find(unit => unit.nodes.some(node => node.key === 'identityReport'));
    const spreadHost = graph.units.find(unit => unit.nodes.some(node => node.key === 'spreadReport'));
    const namedHost = graph.units.find(unit => unit.nodes.some(node => node.key === 'namedReport'));
    const shorthandHost = graph.units.find(unit => unit.nodes.some(node => node.key === 'shorthandReport'));
    const unknownValueHost = graph.units.find(unit => unit.nodes.some(node => node.key === 'unknownValueReport'));

    assert.deepEqual([module.kind, module.exports], ['module', ['clock']]);
    assert.deepEqual([resolved.kind, resolved.installs], ['bag', [module.id]]);
    assert.deepEqual(resolved.edges, [{ from: 'resolvedReport', to: 'now' }]);
    assert.equal(graph.issues.some(issue => issue.unit === resolved.id), false);
    assert.deepEqual(spreadHost.installs, ["clockModule.withRenamedExport({ currentExportKey: 'clock', ...spread })"]);
    assert.deepEqual(namedHost.installs, ['clockModule.withRenamedExport(renameOptions)']);
    assert.deepEqual({
      identityInstalls: identityHost.installs,
      identityHasIssues: graph.issues.some(issue => issue.unit === identityHost.id),
      shorthandInstalls: shorthandHost.installs,
      unknownValueInstalls: unknownValueHost.installs,
    }, {
      identityInstalls: [module.id],
      identityHasIssues: false,
      shorthandInstalls: ['clockModule.withRenamedExport({ currentExportKey, newExportKey })'],
      unknownValueInstalls:
        ["clockModule.withRenamedExport({ currentExportKey: dynamicCurrentExportKey, newExportKey: 'dynamicClock' })"],
    });
    const opaque = new Set([spreadHost.id, namedHost.id, shorthandHost.id, unknownValueHost.id]);
    assert.equal(graph.issues.some(issue => opaque.has(issue.unit)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requirement views accept only closed literal bags and preserve whole-view opacity', () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-graph-requirements-'));
  const file = join(root, 'graph.ts');
  writeFileSync(file, `
declare const DiBag: any;
const billingModule = DiBag.createBuilder()
  .withServices({ billing: ({ shipping }: { shipping: { label(): string } }) => shipping.label() })
  .buildModule({ exportedServiceKeys: ['billing'] });
const options = { currentRequirementKey: 'shipping', newRequirementKey: 'delivery' } as const;
const rest = { newRequirementKey: 'delivery' } as const;
const currentRequirementKey = 'shipping' as const;
const newRequirementKey = 'delivery' as const;
declare const dynamicName: string;
export const wrapped = DiBag.createBuilder()
  .withInstalledModules([((billingModule.withRenamedRequirement({
    'newRequirementKey': ('delivery' as const),
    currentRequirementKey: ('shipping' satisfies string),
  })) as any)])
  .withServices({ delivery: () => ({ label: () => 'ok' }) }).buildContainer();
export const identity = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'shipping' })])
  .withServices({ shipping: () => ({ label: () => 'ok' }) }).buildContainer();
export const shorthand = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey, newRequirementKey })])
  .buildContainer();
export const named = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement(options)])
  .buildContainer();
export const spread = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', ...rest })])
  .buildContainer();
export const nonliteral = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: dynamicName, newRequirementKey: 'delivery' })])
  .buildContainer();
export const duplicate = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', currentRequirementKey: 'other', newRequirementKey: 'delivery' })])
  .buildContainer();
export const extra = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery', unrelated: 'value' })])
  .buildContainer();
export const invalidInner = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement(options)
    .withRenamedExport({ currentExportKey: 'billing', newExportKey: 'invoice' })])
  .buildContainer();
export const missingLiteral = DiBag.createBuilder()
  .withInstalledModules([billingModule.withRenamedRequirement({ currentRequirementKey: 'shipping', newRequirementKey: 'delivery' })])
  .buildContainer();
`);
  try {
    const graph = extractDependencyGraph({ files: [file], root });
    const module = graph.units.find(unit => unit.kind === 'module');
    const host = name => graph.units.find(unit => unit.id === `graph.ts:${readFileSync(file, 'utf8').split('\n').findIndex(line => line.includes(`export const ${name} =`)) + 1}`);
    assert.deepEqual(module.requirements, ['shipping']);
    for (const name of ['wrapped', 'identity']) {
      const unit = host(name);
      assert(unit, name);
      assert.deepEqual(unit.installs, [module.id], name);
      assert.deepEqual(graph.issues.filter(issue => issue.unit === unit.id), [], name);
    }
    for (const name of ['shorthand', 'named', 'spread', 'nonliteral', 'duplicate', 'extra', 'invalidInner']) {
      const unit = host(name);
      assert(unit, name);
      assert.equal(unit.installs.length, 1, name);
      assert.match(unit.installs[0], /withRenamedRequirement\(/, name);
      assert.deepEqual(graph.issues.filter(issue => issue.unit === unit.id), [], name);
    }
    const missing = host('missingLiteral');
    assert.deepEqual(graph.issues.filter(issue => issue.unit === missing.id), [
      { kind: 'unresolved', unit: missing.id, consumer: 'billingModule/billing', dependency: 'shipping' },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
