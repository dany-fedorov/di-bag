import { expect, test } from 'bun:test';
import { DiBag } from '../src';

// Each deliberately malformed call reaches one throw site whose code changes in phase 11.
type Diagnostic = Error & { code: string; details: Record<string, unknown> };
type Row = readonly [title: string, run: () => unknown, code: string, details: Record<string, unknown>];
const D = DiBag as any;

async function diagnosticOf(run: () => unknown): Promise<Diagnostic> {
  try { await run(); } catch (error) { return error as Diagnostic; }
  throw new Error('expected a throw or a rejection');
}

function check(rows: readonly Row[]): void {
  for (const [title, run, code, details] of rows) {
    test(title, async () => {
      const error = await diagnosticOf(run);
      expect(error.code).toBe(code);
      expect(error.details).toMatchObject(details);
      expect(error.message).toStartWith(`${code}: `);
    });
  }
}

const scoped = (factory: () => unknown) => D.providerWithLifetime({ provider: factory, lifetime: 'scoped:one-per-container' });
const builder = () => D.createBuilder().withServices({
  config: scoped(() => ({ region: 'eu' })),
  id: D.providerWithLifetime({ provider: () => 1, lifetime: 'transient:one-per-resolve' }),
});
const container = () => builder().buildContainer();

check([
  // 0.4.0: builder().register({ config: () => 1 })
  ['a service key registered twice', () => builder().withServices({ config: () => 1 }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServices', serviceKey: 'config' }],
  // 0.4.0: builder().alias('config', 'id')
  ['an alias key that is already registered', () => builder().withServiceAlias({ aliasKey: 'config', targetServiceKey: 'id' }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withServiceAlias', serviceKey: 'config' }],
  // 0.4.0: builder().installModule(<a module that exports config>)
  ['a module that exports a key the host already has', () => builder().withInstalledModules([D.createBuilder().withServices({ config: () => 1 }).buildModule({ exportedServiceKeys: ['config'] })]), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withInstalledModules', serviceKey: 'config' }],
  // 0.4.0: <module exporting a and b>.renameExport('a', 'b')
  ['an export renamed onto another export', () => D.createBuilder().withServices({ a: () => 1, b: () => 2 }).buildModule({ exportedServiceKeys: ['a', 'b'] }).withRenamedExport({ currentExportKey: 'a', newExportKey: 'b' }), 'DI_BAG_DUPLICATE_SERVICE_KEY', { operation: 'withRenamedExport', serviceKey: 'b' }],
  // 0.4.0: DiBag.withMetadata(DiBag.withMetadata(f, { static: { owner: 1 } }), { static: { owner: 2 } })
  ['a registration metadata key set twice', () => D.providerWithRegistrationMetadata({ provider: D.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: { owner: 1 } }), registrationMetadata: { owner: 2 } }), 'DI_BAG_DUPLICATE_METADATA_KEY', { operation: 'providerWithRegistrationMetadata', metadataKey: 'owner' }],
]);

void container;

check([
  // 0.4.0: bag.resolve('absent')
  ['resolve of an unknown key', () => container().resolve('absent'), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'resolve', serviceKey: 'absent' }],
  // 0.4.0: builder().alias('other', 'absent')
  ['an alias to an unknown key', () => builder().withServiceAlias({ aliasKey: 'other', targetServiceKey: 'absent' }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withServiceAlias', serviceKey: 'absent' }],
  // 0.4.0: builder().replace('absent', () => 1)
  ['a replacement of an unknown key', () => builder().withReplacedService('absent', () => 1), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withReplacedService', serviceKey: 'absent' }],
  // 0.4.0: bag.fork(['absent'], { absent: () => 1 })
  ['an independent container that replaces an unknown key', () => container().createIndependentContainer(['absent'], { absent: () => 1 }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'createIndependentContainer', serviceKey: 'absent' }],
  // 0.4.0: bag.createScope(['absent'], { absent: () => 1 })
  ['a child container that replaces an unknown key', () => container().createChildContainer(['absent'], { absent: () => 1 }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'createChildContainer', serviceKey: 'absent' }],
  // 0.4.0: bag.createScope({ share: ['absent'] })
  ['a child container that shares an unknown key', () => container().createChildContainer({ sharedParentServiceKeys: ['absent'] }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'createChildContainer', serviceKey: 'absent' }],
  // 0.4.0: builder().buildAndStart(['absent'])
  ['readiness of an unknown key', () => container().ensureServicesReady(['absent']), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'ensureServicesReady', serviceKey: 'absent' }],
  // 0.4.0: <module>.renameExport('absent', 'x')
  ['a rename of an unknown export', () => builder().buildModule({ exportedServiceKeys: ['config'] }).withRenamedExport({ currentExportKey: 'absent', newExportKey: 'x' }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'withRenamedExport', serviceKey: 'absent' }],
  // 0.4.0: builder().buildModule(['absent'])
  ['a module that exports an unknown key', () => builder().buildModule({ exportedServiceKeys: ['absent'] }), 'DI_BAG_UNKNOWN_SERVICE_KEY', { operation: 'buildModule', serviceKey: 'absent' }],
]);

check([
  // 0.4.0: bag.fork(['config'], {})
  ['an independent container without the provider for a replaced key', () => container().createIndependentContainer(['config'], {}), 'DI_BAG_MISSING_REPLACEMENT_PROVIDER', { operation: 'createIndependentContainer', serviceKey: 'config' }],
  // 0.4.0: bag.createScope(['config'], {})
  ['a child container without the provider for a replaced key', () => container().createChildContainer(['config'], {}), 'DI_BAG_MISSING_REPLACEMENT_PROVIDER', { operation: 'createChildContainer', serviceKey: 'config' }],
  // 0.4.0: bag.createScope(['config'], { config: ... }, { share: ['config'] })
  ['a key both replaced and shared', () => container().createChildContainer(['config'], { config: scoped(() => ({ region: 'us' })) }, { sharedParentServiceKeys: ['config'] }), 'DI_BAG_CONFLICTING_SERVICE_SELECTION', { operation: 'createChildContainer', serviceKey: 'config', conflict: 'shared-and-replaced' }],
  // 0.4.0: bag.createScope({ share: ['id'] })
  ['a transient service shared with a child', () => container().createChildContainer({ sharedParentServiceKeys: ['id'] }), 'DI_BAG_CONFLICTING_SERVICE_SELECTION', { operation: 'createChildContainer', serviceKey: 'id', conflict: 'shared-transient' }],
]);

check([
  // 0.4.0: builder().register({ bad: 42 })
  ['a service that is neither a function nor a provider', () => builder().withServices({ bad: 42 }), 'DI_BAG_INVALID_PROVIDER', { operation: 'withServices' }],
  // 0.4.0: resolve of DiBag.withMetadata(f, { dynamic: { mode: 'direct', describe: () => 42 } })
  ['a describe callback that returns a bad record', () => D.createBuilder().withServices({ value: D.providerWithAcquisitionMetadata({ provider: D.createProvider(() => 1), describeAcquisition: () => 42, callbackReceives: 'exposed-service' }) }).buildContainer().resolve('value'), 'DI_BAG_INVALID_ACQUISITION_METADATA', { operation: 'providerWithAcquisitionMetadata' }],
]);

const plugin = { apiVersion: 1, create: () => 1, dispose: () => {} };
const isNumber = (value: unknown): value is number => typeof value === 'number';
const singleton = 'singleton:one-per-container-tree';
const argument = (title: string, run: () => unknown, operation: string, name: string, expected: string): Row =>
  [`${operation}: ${title}`, run, 'DI_BAG_INVALID_ARGUMENT', { operation, argument: name, expected }];

check([
  argument('factory is not a function', () => D.createProvider(42), 'createProvider', 'factory', 'a function'),
  argument('options is not an object', () => D.createProvider(() => 1, 42), 'createProvider', 'options', 'an object'),
  argument('unknown factoryReturnKind', () => D.createProvider(() => 1, { factoryReturnKind: 'bad' }), 'createProvider', 'factoryReturnKind', "one of: 'auto-detect', 'sync-value', 'native-promise', 'uninspected'"),
  argument('factoryReceivesContext is not a boolean', () => D.createProvider(() => 1, { factoryReceivesContext: 'bad' }), 'createProvider', 'factoryReceivesContext', 'a boolean'),
  argument('options is not an object', () => D.createProviderFromFunction(42), 'createProviderFromFunction', 'options', 'an object'),
  argument('factoryFunction is not a function', () => D.createProviderFromFunction({ dependencies: [], factoryFunction: 42 }), 'createProviderFromFunction', 'factoryFunction', 'a function'),
  argument('serviceClass is not a function', () => D.createProviderFromClass({ dependencies: [], serviceClass: 42 }), 'createProviderFromClass', 'serviceClass', 'a function'),
  argument('serviceClass cannot be constructed', () => D.createProviderFromClass({ dependencies: [], serviceClass: () => 1 }), 'createProviderFromClass', 'serviceClass', 'a constructor that can be called with new'),
  argument('options is not an object', () => D.createProviderFromPlugin(42), 'createProviderFromPlugin', 'options', 'an object'),
  argument('factoryReturnKind is missing', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, isValidPluginOutput: isNumber }), 'createProviderFromPlugin', 'factoryReturnKind', 'present'),
  argument('factoryReturnKind may not be inspected', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, isValidPluginOutput: isNumber, factoryReturnKind: 'auto-detect' }), 'createProviderFromPlugin', 'factoryReturnKind', "one of: 'uninspected', 'native-promise'"),
  argument('isValidPluginOutput is missing', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, factoryReturnKind: 'uninspected' }), 'createProviderFromPlugin', 'isValidPluginOutput', 'present'),
  argument('isValidPluginOutput is not a function', () => D.createProviderFromPlugin({ dependencies: [], pluginDescriptor: plugin, isValidPluginOutput: 1, factoryReturnKind: 'uninspected' }), 'createProviderFromPlugin', 'isValidPluginOutput', 'a function'),
  argument('unknown lifetime', () => D.providerWithLifetime({ provider: () => 1, lifetime: 'bad' }), 'providerWithLifetime', 'lifetime', "one of: 'singleton:one-per-container-tree', 'scoped:one-per-container', 'transient:one-per-resolve'"),
  argument('options is not an object', () => D.providerWithLifetime(42), 'providerWithLifetime', 'options', 'an object'),
  argument('unknown option', () => D.providerWithLifetime({ provider: () => 1, lifetime: singleton, other: true }), 'providerWithLifetime', 'options', 'only the own properties: provider, lifetime, allowsScopedDependencies'),
  argument('allowsScopedDependencies on a scoped service', () => D.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container', allowsScopedDependencies: true }), 'providerWithLifetime', 'allowsScopedDependencies', "absent unless lifetime is 'singleton:one-per-container-tree'"),
  argument('allowsScopedDependencies is not a boolean', () => D.providerWithLifetime({ provider: () => 1, lifetime: singleton, allowsScopedDependencies: 1 }), 'providerWithLifetime', 'allowsScopedDependencies', 'a boolean'),
  argument('registrationMetadata is not an object', () => D.providerWithRegistrationMetadata({ provider: () => 1, registrationMetadata: 42 }), 'providerWithRegistrationMetadata', 'registrationMetadata', 'an object'),
  argument('options is not an object', () => D.providerWithAcquisitionMetadata(42), 'providerWithAcquisitionMetadata', 'options', 'an object'),
  argument('unknown callbackReceives', () => D.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: () => ({}), callbackReceives: 'bad' }), 'providerWithAcquisitionMetadata', 'callbackReceives', "one of: 'exposed-service', 'fulfilled-value'"),
  argument('describeAcquisition is not a function', () => D.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: 42, callbackReceives: 'exposed-service' }), 'providerWithAcquisitionMetadata', 'describeAcquisition', 'a function'),
  argument('unknown callbackReceives', () => D.providerWithTransformedService({ provider: () => 1, transformService: (value: unknown) => value, callbackReceives: 'bad' }), 'providerWithTransformedService', 'callbackReceives', "one of: 'exposed-service', 'fulfilled-value'"),
  argument('transformService is not a function', () => D.providerWithTransformedService({ provider: () => 1, transformService: 42, callbackReceives: 'exposed-service' }), 'providerWithTransformedService', 'transformService', 'a function'),
  argument('transformReturnKind with a fulfilled value', () => D.providerWithTransformedService({ provider: () => 1, transformService: (value: unknown) => value, callbackReceives: 'fulfilled-value', transformReturnKind: 'uninspected' }), 'providerWithTransformedService', 'transformReturnKind', "absent when callbackReceives is 'fulfilled-value'"),
  argument('disposer is not a function', () => D.createBuilder().withServices({ value: D.createProvider((_dependencies: unknown, factoryContext: any) => { factoryContext.pushDisposer(42); return 1; }, { factoryReceivesContext: true }) }).buildContainer().resolve('value'), 'pushDisposer', 'disposer', 'a function'),
  argument('services is not an object', () => D.createBuilder().withServices(42), 'withServices', 'services', 'an object'),
  argument('a symbol key', () => D.createBuilder().withServices({ [Symbol('s')]: () => 1 }), 'withServices', 'services', 'only string keys'),
  argument('exportedServiceKeys is not an array', () => builder().buildModule({ exportedServiceKeys: 'bad' }), 'buildModule', 'exportedServiceKeys', 'an array'),
  argument('moduleLabel is empty', () => builder().buildModule({ exportedServiceKeys: ['config'], moduleLabel: '' }), 'buildModule', 'moduleLabel', 'a non-empty string'),
  argument('currentExportKey is not a string', () => builder().buildModule({ exportedServiceKeys: ['config'] }).withRenamedExport({ currentExportKey: 1, newExportKey: 'x' }), 'withRenamedExport', 'currentExportKey', 'a string'),
  argument('newExportKey is not a string', () => builder().buildModule({ exportedServiceKeys: ['config'] }).withRenamedExport({ currentExportKey: 'config', newExportKey: 1 }), 'withRenamedExport', 'newExportKey', 'a string'),
  argument('replacedServiceKeys is not an array', () => container().createChildContainer('bad', {}), 'createChildContainer', 'replacedServiceKeys', 'an array'),
  argument('replacementProviders is not an object', () => container().createChildContainer(['config'], 42), 'createChildContainer', 'replacementProviders', 'an object'),
  argument('unknown option', () => container().createChildContainer([], {}, { other: [] }), 'createChildContainer', 'options', 'only the own properties: sharedParentServiceKeys'),
  argument('replacedServiceKeys is not an array', () => container().createIndependentContainer('bad', {}), 'createIndependentContainer', 'replacedServiceKeys', 'an array'),
  argument('replacementProviders is not an object', () => container().createIndependentContainer(['config'], null), 'createIndependentContainer', 'replacementProviders', 'an object'),
  argument('serviceKeys is not an array', () => container().ensureServicesReady('bad'), 'ensureServicesReady', 'serviceKeys', 'an array'),
  argument('options is not an object', () => container().ensureServicesReady(['config'], 42), 'ensureServicesReady', 'options', 'an object'),
  argument('maxConcurrentServiceKeys is zero', () => container().ensureServicesReady(['config'], { maxConcurrentServiceKeys: 0 }), 'ensureServicesReady', 'maxConcurrentServiceKeys', 'a positive safe integer'),
  argument('totalTimeoutMs is negative', () => container().ensureServicesReady(['config'], { totalTimeoutMs: -1 }), 'ensureServicesReady', 'totalTimeoutMs', 'a finite positive number'),
  argument('abortSignal is not an AbortSignal', () => container().ensureServicesReady(['config'], { abortSignal: {} }), 'ensureServicesReady', 'abortSignal', 'an AbortSignal'),
  argument('options is not an object', () => container().close(42), 'close', 'options', 'an object'),
  argument('unknown option', () => container().close({ other: 1 }), 'close', 'options', 'only the own properties: abortSignal, waitTimeoutMs'),
  argument('waitTimeoutMs is zero', () => container().close({ waitTimeoutMs: 0 }), 'close', 'waitTimeoutMs', 'a finite positive number'),
  argument('abortSignal is not an AbortSignal', () => container().close({ abortSignal: {} }), 'close', 'abortSignal', 'an AbortSignal'),
  argument('options is not an object', () => D.withConfiguration(null), 'withConfiguration', 'options', 'an object'),
  argument('runtime is not an object', () => D.withConfiguration({ runtime: 42 }), 'withConfiguration', 'runtime', 'an object'),
  argument('runtime has no classifier', () => D.withConfiguration({ runtime: {} }), 'withConfiguration', 'runtime.isNativePromise', 'a function'),
  argument('lifecycleObservers is not an array', () => D.withConfiguration({ lifecycleObservers: 42 }), 'withConfiguration', 'lifecycleObservers', 'an array'),
  argument('an observer is not an object', () => D.withConfiguration({ lifecycleObservers: [null] }), 'withConfiguration', 'lifecycleObservers[]', 'an object'),
  argument('onLifecycleEvent is not a function', () => D.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: 1, onObserverFailure: () => {} }] }), 'withConfiguration', 'lifecycleObservers[].onLifecycleEvent', 'a function'),
  argument('onObserverFailure is not a function', () => D.withConfiguration({ lifecycleObservers: [{ onLifecycleEvent: () => {}, onObserverFailure: 2 }] }), 'withConfiguration', 'lifecycleObservers[].onObserverFailure', 'a function'),
]);
