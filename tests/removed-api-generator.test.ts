import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { removedApi } from '../src/removed-api';

const script = resolve(__dirname, '../scripts/generate-removed-api.mjs');
const map = resolve(__dirname, 'fixtures/removed-api/map.json');
const run = (out: string, ...flags: string[]) => spawnSync('node', [script, '--map', map, '--out', out, ...flags], { encoding: 'utf8' });

test('one stub per removed callable name, none for a name that is still live', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'removed-api-')), 'removed-api.ts');
  const result = run(out);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('10 stubs for 3 owners');
  const text = readFileSync(out, 'utf8');
  // Renamed: a stub that names the new call, with the receiver a reader would type.
  expect(text).toContain('"build": "builder.buildContainer",');
  // Moved to another object under the SAME name: still a stub on the old owner.
  expect(text).toContain('"withDisposal": "DiBag.providerWithDisposal({ provider, disposeService })",');
  // Only the arguments changed: the name is live and gets no stub.
  expect(text).not.toContain('"buildModule"');
});

test('the real map has exactly the reviewed replacement for every removed callable', () => {
  const actual = Object.fromEntries(Object.entries(removedApi).flatMap(([owner, names]) =>
    Object.entries(names).map(([name, replacement]) => [`${owner}.${name}`, replacement])));
  expect(actual).toEqual({
    'Bag.createScope': 'container.createChildContainer(replacedServiceKeys, replacementProviders, { sharedParentServiceKeys }); use container.createChildContainer() or container.createChildContainer({ sharedParentServiceKeys }) when no services are replaced',
    'Bag.fork': 'container.createIndependentContainer(replacedServiceKeys, replacementProviders); use container.createIndependentContainer() when no services are replaced',
    'Bag.inspect': 'container.serviceSnapshot(serviceKey)',
    'Bag.inspectAll': 'container.serviceSnapshot(collectionToken); create collectionToken with DiBag.createToken(symbol).forCollectionOf<Item>(), and manually split any mixed single-service and collection uses into tokens with distinct symbols',
    'Bag.inspectGraph': 'container.graphSnapshot()',
    'Bag.resolveAll': 'container.resolveCollection(collectionToken); create collectionToken with DiBag.createToken(symbol).forCollectionOf<Item>(), and manually split any mixed single-service and collection uses into tokens with distinct symbols',
    'Builder.alias': 'builder.withServiceAlias({ aliasKey, targetServiceKey })',
    'Builder.build': 'builder.buildContainer',
    'Builder.buildAndStart': 'builder.buildContainer().ensureServicesReady(serviceKeys, options); rename signal to abortSignal and timeoutMs to totalTimeoutMs; replace startupOrder with maxConcurrentServiceKeys (omit for parallel, 1 for sequential, or the number); options may be omitted',
    'Builder.contribute': 'builder.withCollectionContribution({ collectionToken, provider }); create collectionToken with DiBag.createToken(symbol).forCollectionOf<Item>()',
    'Builder.installModule': 'builder.withInstalledModules([module])',
    'Builder.register': 'builder.withServices({ key: provider }) or builder.withTokenService(token, provider)',
    'Builder.replace': 'builder.withReplacedService',
    'Builder.verifyGraph': 'builder.verifyGraphAtCompileTime',
    'DiBagApi.all': 'the collection token itself, from DiBag.createToken(symbol).forCollectionOf<Item>()',
    'DiBagApi.fromAsyncFactory': "DiBag.createProvider(factory, { factoryReturnKind: 'native-promise' }); add factoryReceivesContext: true if the old call used context: 'acquisition'",
    'DiBagApi.fromClass': 'DiBag.createProviderFromClass({ dependencies, serviceClass }); move any acquisitionMode option into this object as factoryReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise)',
    'DiBagApi.fromFactory': "DiBag.createProvider(factory, options); rename acquisitionMode to factoryReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise) and context: 'acquisition' to factoryReceivesContext: true; options may be omitted",
    'DiBagApi.fromFunction': 'DiBag.createProviderFromFunction({ dependencies, factoryFunction }); move any acquisitionMode option into this object as factoryReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise)',
    'DiBagApi.fromPlugin': 'DiBag.createProviderFromPlugin({ dependencies, pluginDescriptor, factoryReturnKind, isValidPluginOutput }); rename validate to isValidPluginOutput and map acquisitionMode raw -> uninspected or nativePromise -> native-promise',
    'DiBagApi.fromSyncFactory': "DiBag.createProvider(factory, { factoryReturnKind: 'sync-value' }); add factoryReceivesContext: true if the old call used context: 'acquisition'",
    'DiBagApi.token': 'DiBag.createToken(symbol).forService<Service>() or DiBag.createToken(symbol).forCollectionOf<Item>(); choose the kind manually from its uses, and split mixed single-service and collection uses into tokens with distinct symbols',
    'DiBagApi.transformService': 'DiBag.providerWithTransformedService({ provider, transformService, callbackReceives }); map mode direct -> exposed-service or awaited -> fulfilled-value; for exposed-service callbacks, rename acquisitionMode to transformReturnKind (auto -> auto-detect, raw -> uninspected, nativePromise -> native-promise)',
    'DiBagApi.withDisposal': 'DiBag.providerWithDisposal({ provider, disposeService })',
    'DiBagApi.withLifetime': 'DiBag.providerWithLifetime({ provider, lifetime }); map root -> singleton:one-per-container-tree, scoped -> scoped:one-per-container, or transient -> transient:one-per-resolve; move allowScopedDependencies into this object as allowsScopedDependencies',
    'DiBagApi.withMetadata': 'DiBag.providerWithRegistrationMetadata({ provider, registrationMetadata }) for static metadata, or DiBag.providerWithAcquisitionMetadata({ provider, describeAcquisition, callbackReceives }) for dynamic metadata; map mode direct -> exposed-service or awaited -> fulfilled-value; combined static and dynamic metadata requires manually composing both calls while preserving evaluation order',
    'Module.renameExport': 'module.withRenamedExport({ currentExportKey, newExportKey })',
    'token().of': 'DiBag.createToken(symbol).forService<Service>() or DiBag.createToken(symbol).forCollectionOf<Item>(); choose the kind manually from its uses, and split mixed single-service and collection uses into tokens with distinct symbols',
  });
});

test('--check accepts the generated file and rejects a stale one', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'removed-api-')), 'removed-api.ts');
  expect(run(out).status).toBe(0);
  expect(run(out, '--check').status).toBe(0);
  writeFileSync(out, readFileSync(out, 'utf8').replace('createProvider', 'somethingElse'));
  const stale = run(out, '--check');
  expect(stale.status).toBe(1);
  expect(stale.stderr).toContain('is stale');
});

test('the committed src/removed-api.ts is what the generator writes from the real map', () => {
  const result = spawnSync('node', [script, '--check'], { cwd: resolve(__dirname, '..'), encoding: 'utf8' });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});
