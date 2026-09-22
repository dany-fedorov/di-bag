import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
