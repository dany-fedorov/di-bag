import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('a labelled module exposes its label and installation origin even when every binding is exported', async () => {
  const feature = DiBag.createBuilder().withServices({ answer: () => 42 })
    .buildModule({ exportedServiceKeys: ['answer'], moduleLabel: 'application.capacity' });
  expect(feature.moduleLabel).toBe('application.capacity');
  const container = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
  const snapshot = container.graphSnapshot();
  expect(snapshot.moduleInstallations).toHaveLength(1);
  expect(snapshot.moduleInstallations[0]).toEqual({
    installationId: expect.any(Symbol), moduleLabel: 'application.capacity', parentInstallationId: undefined,
  });
  expect(snapshot.bindings[0]!.moduleInstallationId).toBe(snapshot.moduleInstallations[0]!.installationId);
  await container.close();
});

test('unlabelled and renamed views retain exactly their sealed label and remain frozen', async () => {
  const feature = DiBag.createBuilder().withServices({ service: ({ config }: { config: number }) => config })
    .buildModule({ exportedServiceKeys: ['service'] });
  const renamedExport = feature.withRenamedExport({ currentExportKey: 'service', newExportKey: 'result' });
  const renamedRequirement = feature.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'setting' });
  expect([feature.moduleLabel, renamedExport.moduleLabel, renamedRequirement.moduleLabel]).toEqual([undefined, undefined, undefined]);
  expect(Reflect.set(feature, 'moduleLabel', 'changed')).toBe(false);
  const container = DiBag.createBuilder().withInstalledModules([renamedExport]).withServices({ config: () => 1 }).buildContainer();
  expect(container.graphSnapshot().moduleInstallations[0]!.moduleLabel).toBeUndefined();
  await container.close();
});

test('labelled rename views expose the original label without changing their installations', async () => {
  const feature = DiBag.createBuilder().withServices({ value: ({ config }: { config: number }) => config })
    .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'feature/original' });
  const renamedExport = feature.withRenamedExport({ currentExportKey: 'value', newExportKey: 'result' });
  const renamedRequirement = renamedExport.withRenamedRequirement({ currentRequirementKey: 'config', newRequirementKey: 'setting' });
  expect([feature.moduleLabel, renamedExport.moduleLabel, renamedRequirement.moduleLabel])
    .toEqual(['feature/original', 'feature/original', 'feature/original']);
  const container = DiBag.createBuilder().withInstalledModules([renamedRequirement])
    .withServices({ setting: () => 1 }).buildContainer();
  expect(container.graphSnapshot().moduleInstallations[0]!.moduleLabel).toBe('feature/original');
  await container.close();
});

test('binding labels with slashes cannot forge an installation', async () => {
  const container = DiBag.createBuilder().withServices({ 'outer/inner/value': () => 1 }).buildContainer();
  const snapshot = container.graphSnapshot();
  expect(snapshot.moduleInstallations).toEqual([]);
  expect(snapshot.bindings[0]!.bindingLabel).toBe('outer/inner/value');
  expect(snapshot.bindings[0]!.moduleInstallationId).toBeUndefined();
  await container.close();
});

test('unlabelled wrappers and nested empty modules have ordered records without bindings', async () => {
  const empty = DiBag.createBuilder().buildModule({ exportedServiceKeys: [], moduleLabel: 'empty' });
  const wrapper = DiBag.createBuilder().withInstalledModules([empty]).buildModule({ exportedServiceKeys: [] });
  const container = DiBag.createBuilder().withInstalledModules([wrapper]).buildContainer();
  const snapshot = container.graphSnapshot();
  expect(snapshot.bindings).toEqual([]);
  expect(snapshot.moduleInstallations.map(record => record.moduleLabel)).toEqual([undefined, 'empty']);
  expect(snapshot.moduleInstallations[1]!.parentInstallationId).toBe(snapshot.moduleInstallations[0]!.installationId);
  await container.close();
});

test('two renamed installations remap whole subtrees to disjoint identities', async () => {
  const leaf = DiBag.createBuilder().withServices({ value: () => 1 })
    .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'leaf' });
  const inner = DiBag.createBuilder().withInstalledModules([leaf])
    .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'inner' });
  const outer = DiBag.createBuilder().withInstalledModules([inner])
    .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'outer' });
  const container = DiBag.createBuilder()
    .withInstalledModules([outer.withRenamedExport({ currentExportKey: 'value', newExportKey: 'left' })])
    .withInstalledModules([outer.withRenamedExport({ currentExportKey: 'value', newExportKey: 'right' })])
    .buildContainer();
  const { moduleInstallations: records, bindings } = container.graphSnapshot();
  expect(records.map(record => record.moduleLabel)).toEqual(['outer', 'inner', 'leaf', 'outer', 'inner', 'leaf']);
  expect(new Set(records.map(record => record.installationId)).size).toBe(6);
  expect(records[1]!.parentInstallationId).toBe(records[0]!.installationId);
  expect(records[2]!.parentInstallationId).toBe(records[1]!.installationId);
  expect(records[4]!.parentInstallationId).toBe(records[3]!.installationId);
  expect(records[5]!.parentInstallationId).toBe(records[4]!.installationId);
  expect(bindings.find(binding => binding.serviceKeys.includes('left'))!.moduleInstallationId).toBe(records[2]!.installationId);
  expect(bindings.find(binding => binding.serviceKeys.includes('right'))!.moduleInstallationId).toBe(records[5]!.installationId);
  await container.close();
});

test('sibling installations appear in declaration order under a contiguous parent subtree', async () => {
  const first = DiBag.createBuilder().buildModule({ exportedServiceKeys: [], moduleLabel: 'first' });
  const second = DiBag.createBuilder().buildModule({ exportedServiceKeys: [], moduleLabel: 'second' });
  const parent = DiBag.createBuilder().withInstalledModules([first, second])
    .buildModule({ exportedServiceKeys: [], moduleLabel: 'parent' });
  const container = DiBag.createBuilder().withInstalledModules([parent, first]).buildContainer();
  const records = container.graphSnapshot().moduleInstallations;
  expect(records.map(record => record.moduleLabel)).toEqual(['parent', 'first', 'second', 'first']);
  expect(records.slice(1, 3).map(record => record.parentInstallationId)).toEqual([records[0]!.installationId, records[0]!.installationId]);
  expect(records[3]!.parentInstallationId).toBeUndefined();
  await container.close();
});

test('host registrations and an alias to a module export have no module origin', async () => {
  const feature = DiBag.createBuilder().withServices({ value: () => 1 }).buildModule({ exportedServiceKeys: ['value'] });
  const container = DiBag.createBuilder().withInstalledModules([feature])
    .withServices({ host: () => 2 })
    .withServiceAlias({ aliasKey: 'copy', targetServiceKey: 'value' }).buildContainer();
  const bindings = container.graphSnapshot().bindings;
  expect(bindings.find(binding => binding.serviceKeys.includes('value'))!.moduleInstallationId).toBeDefined();
  expect(bindings.find(binding => binding.serviceKeys.includes('host'))!.moduleInstallationId).toBeUndefined();
  expect(bindings.find(binding => binding.serviceKeys.includes('copy'))!.moduleInstallationId).toBeUndefined();
  await container.close();
});

test('replacement keeps installation records and inherited private origins', async () => {
  const feature = DiBag.createBuilder().withServices({
    secret: () => 1,
    exposed: ({ secret }: { secret: number }) => secret,
  }).buildModule({ exportedServiceKeys: ['exposed'], moduleLabel: 'feature' });
  const builder = DiBag.createBuilder().withInstalledModules([feature]);
  const base = builder.buildContainer();
  const replaced = builder.withReplacedService('exposed', () => 2).buildContainer();
  const original = base.graphSnapshot();
  const changed = replaced.graphSnapshot();
  expect(changed.moduleInstallations[0]!.installationId).toBe(original.moduleInstallations[0]!.installationId);
  expect(changed.bindings.find(binding => binding.serviceKeys.includes('exposed'))!.moduleInstallationId).toBeUndefined();
  expect(changed.bindings.find(binding => binding.bindingLabel === 'feature/secret')!.moduleInstallationId).toBe(original.moduleInstallations[0]!.installationId);
  await replaced.close(); await base.close();
});

test('repeated builds and derived containers preserve inherited IDs and freeze snapshots', async () => {
  const feature = DiBag.createBuilder().withServices({ value: () => 1 }).buildModule({ exportedServiceKeys: ['value'] });
  const builder = DiBag.createBuilder().withInstalledModules([feature]);
  const first = builder.buildContainer();
  const second = builder.buildContainer();
  const child = first.createChildContainer(['value'], { value: () => 2 });
  const independent = first.createIndependentContainer(['value'], { value: () => 3 });
  const snapshots = [first, second, child, independent].map(container => container.graphSnapshot());
  expect(new Set(snapshots.map(snapshot => snapshot.moduleInstallations[0]!.installationId)).size).toBe(1);
  expect(Object.isFrozen(snapshots[0]!.moduleInstallations)).toBe(true);
  expect(Object.isFrozen(snapshots[0]!.moduleInstallations[0])).toBe(true);
  expect(Reflect.set(snapshots[0]!.moduleInstallations[0]!, 'moduleLabel', 'changed')).toBe(false);
  expect(snapshots[0]!.moduleInstallations[0]!.moduleLabel).toBeUndefined();
  expect(snapshots[2]!.bindings[0]!.moduleInstallationId).toBeUndefined();
  expect(snapshots[3]!.bindings[0]!.moduleInstallationId).toBeUndefined();
  await child.close(); await independent.close(); await second.close(); await first.close();
});

test('snapshot and label reads do not acquire lazy providers', async () => {
  let acquisitions = 0;
  const feature = DiBag.createBuilder().withServices({ value: () => { acquisitions++; return 1; } })
    .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'lazy' });
  const container = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
  expect(feature.moduleLabel).toBe('lazy');
  expect(container.graphSnapshot().moduleInstallations).toHaveLength(1);
  expect(acquisitions).toBe(0);
  await container.close();
});

test('module aliases, tokens, and contributions retain their declaring installation', async () => {
  const tokenKey = Symbol('value');
  const groupKey = Symbol('group');
  const token = DiBag.createToken(tokenKey).forService<number>();
  const group = DiBag.createToken(groupKey).forCollectionOf<number>();
  const feature = DiBag.createBuilder()
    .withTokenService(token, () => 1)
    .withServiceAlias({ aliasKey: 'alias', targetServiceKey: token })
    .withCollectionContribution({ collectionToken: group, provider: () => 2 })
    .buildModule({ exportedServiceKeys: ['alias', token], moduleLabel: 'feature' });
  const container = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
  const snapshot = container.graphSnapshot();
  const origin = snapshot.moduleInstallations[0]!.installationId;
  const alias = snapshot.bindings.find(binding => binding.serviceKeys.includes('alias'))!;
  const target = snapshot.bindings.find(binding => binding.serviceKeys.includes(token.symbol))!;
  const contributionId = snapshot.contributions[0]!.bindingIds[0]!;
  expect(alias.moduleInstallationId).toBe(origin);
  expect(alias.aliasTarget?.bindingId).toBe(target.bindingId);
  expect(target.moduleInstallationId).toBe(origin);
  expect(snapshot.bindings.find(binding => binding.bindingId === contributionId)!.moduleInstallationId).toBe(origin);
  await container.close();
});

test('an installation survives replacing its only exported binding', async () => {
  const feature = DiBag.createBuilder().withServices({ value: () => 1 })
    .buildModule({ exportedServiceKeys: ['value'], moduleLabel: 'feature' });
  const container = DiBag.createBuilder().withInstalledModules([feature])
    .withReplacedService('value', () => 2).buildContainer();
  const snapshot = container.graphSnapshot();
  expect(snapshot.moduleInstallations.map(record => record.moduleLabel)).toEqual(['feature']);
  expect(snapshot.bindings).toHaveLength(1);
  expect(snapshot.bindings[0]!.moduleInstallationId).toBeUndefined();
  await container.close();
});

test('later installations do not alter earlier builders or captured snapshots', async () => {
  const first = DiBag.createBuilder().buildModule({ exportedServiceKeys: [], moduleLabel: 'first' });
  const second = DiBag.createBuilder().buildModule({ exportedServiceKeys: [], moduleLabel: 'second' });
  const earlyBuilder = DiBag.createBuilder().withInstalledModules([first]);
  const early = earlyBuilder.buildContainer();
  const captured = early.graphSnapshot();
  const later = earlyBuilder.withInstalledModules([second]).buildContainer();
  expect(captured.moduleInstallations.map(record => record.moduleLabel)).toEqual(['first']);
  expect(early.graphSnapshot().moduleInstallations[0]!.installationId).toBe(captured.moduleInstallations[0]!.installationId);
  expect(later.graphSnapshot().moduleInstallations.map(record => record.moduleLabel)).toEqual(['first', 'second']);
  expect(later.graphSnapshot().moduleInstallations[0]!.installationId).toBe(captured.moduleInstallations[0]!.installationId);
  await later.close(); await early.close();
});

test('slash keys and labels remain valid through alias and both module renames', async () => {
  const feature = DiBag.createBuilder().withServices({
    'value/one': ({ 'config/one': config }: { 'config/one': number }) => config,
  }).withServiceAlias({ aliasKey: 'alias/one', targetServiceKey: 'value/one' })
    .buildModule({ exportedServiceKeys: ['alias/one'], moduleLabel: 'feature/one' })
    .withRenamedExport({ currentExportKey: 'alias/one', newExportKey: 'alias/two' })
    .withRenamedRequirement({ currentRequirementKey: 'config/one', newRequirementKey: 'config/two' });
  const container = DiBag.createBuilder().withInstalledModules([feature])
    .withServices({ 'config/two': () => 7 }).buildContainer();
  expect(feature.moduleLabel).toBe('feature/one');
  expect(container.resolve('alias/two')).toBe(7);
  expect(container.graphSnapshot().moduleInstallations[0]!.moduleLabel).toBe('feature/one');
  await container.close();
});
