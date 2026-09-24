import { DiBag, type FactoryContext, type DisposerContext } from '../../../src';

const builder = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) });
const ready = builder.buildContainer();
// diagnostic: ensureServicesReady accepts existing names or typed tokens only
ready.ensureServicesReady(['missing']);
const widened: string[] = ['value'];
// diagnostic: ensureServicesReady requires a finite tuple
ready.ensureServicesReady(widened);
declare const optional: readonly ['value'?];
// diagnostic: ensureServicesReady requires a finite tuple
ready.ensureServicesReady(optional);
// diagnostic: Expected 1-2 arguments
ready.ensureServicesReady();
// diagnostic: not assignable
ready.ensureServicesReady(['value'], { maxConcurrentServiceKeys: 'serial' });
// diagnostic: not assignable
ready.ensureServicesReady(['value'], { maxConcurrentServiceKeys: true });
// diagnostic: not assignable
ready.ensureServicesReady(['value'], { totalTimeoutMs: '1' });
// diagnostic: missing the following properties from type 'AbortSignal'
ready.ensureServicesReady(['value'], { abortSignal: {} });
// diagnostic: does not exist in type 'EnsureServicesReadyOptions'
ready.ensureServicesReady(['value'], { extra: true });
// diagnostic: does not exist in type 'EnsureServicesReadyOptions'
ready.ensureServicesReady(['value'], { timeoutMs: 1 });
// diagnostic: does not exist in type 'EnsureServicesReadyOptions'
ready.ensureServicesReady(['value'], { startupOrder: 'sequential' });
const missing = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: DiBag.createProvider((deps: { absent: number }, _factoryCtx) => deps.absent, { factoryReceivesContext: true }), lifetime: 'scoped:one-per-container' }) });
// diagnostic: required service registrations are missing
missing.buildContainer().ensureServicesReady([]);
const captive = DiBag.createBuilder().withServices({
  scoped: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }),
  root: DiBag.providerWithLifetime({ provider: DiBag.createProvider((deps: { scoped: number }, _factoryCtx) => deps.scoped, { factoryReceivesContext: true }), lifetime: 'singleton:one-per-container-tree' }),
});
// diagnostic: root lifetime cannot capture scoped dependency
captive.buildContainer().ensureServicesReady(['root']);
const exportless = DiBag.createBuilder().withServices({ hidden: DiBag.providerWithLifetime({ provider: (deps: { missing: number }) => deps.missing, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: [] });
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([exportless]).buildContainer().ensureServicesReady([]);
const key: unique symbol = Symbol('token');
const otherKey: unique symbol = Symbol('token');
const token = DiBag.createToken(key).forService<number>();
const other = DiBag.createToken(otherKey).forService<number>();
// diagnostic: ensureServicesReady accepts existing names or typed tokens only
DiBag.createBuilder().withTokenService(token, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).buildContainer().ensureServicesReady([other]);
// diagnostic: not assignable
DiBag.createProvider(function (this: { required: true }, _deps: {}, _factoryCtx) { return 1; }, { factoryReceivesContext: true });
// diagnostic: Target signature provides too few arguments
DiBag.createProvider((_deps: {}, _factoryCtx: FactoryContext, extra: number) => extra, { factoryReceivesContext: true });
// diagnostic: not assignable
DiBag.createProvider((_deps: {}, _factoryContext) => 1, { factoryReceivesContext: true, ...{ factoryReturnKind: 'native-promise' as const } });
DiBag.createProvider((_deps: {}, factoryCtx) => {
  // diagnostic: Cannot assign to 'abortSignal' because it is a read-only property
  factoryCtx.abortSignal = new AbortController().signal;
  // diagnostic: Property 'abort' does not exist on type 'FactoryContext'
  factoryCtx.abort();
  // diagnostic: Argument of type 'number' is not assignable to parameter of type '(this: void, disposerContext: DisposerContext) => void | Promise<void>'
  factoryCtx.pushDisposer(1);
  // diagnostic: Target signature provides too few arguments. Expected 2 or more, but got 1.
  factoryCtx.pushDisposer((_disposerCtx: DisposerContext, extra: number) => extra);
  factoryCtx.pushDisposer(disposerCtx => {
    // diagnostic: Cannot assign to 'reason' because it is a read-only property
    disposerCtx.reason = 'factory-failed';
    // diagnostic: have no overlap
    if (disposerCtx.reason === 'disposed') return;
  });
}, { factoryReceivesContext: true });
const closable = DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildContainer();
// diagnostic: not assignable
closable.close({ waitTimeoutMs: '1' });
// diagnostic: does not exist in type 'CloseOptions'
closable.close({ maxConcurrentServiceKeys: 1 });
// diagnostic: missing the following properties from type 'AbortSignal'
closable.close({ abortSignal: {} });
// diagnostic: does not exist in type 'CloseOptions'
closable.close({ timeoutMs: 1 });
// diagnostic: does not exist in type 'CloseOptions'
closable.close({ signal: new AbortController().signal });
// diagnostic: not assignable
DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['value'], moduleLabel: 1 });
// diagnostic: 'name' does not exist in type 'ModuleOptions &
DiBag.createBuilder().withServices({ value: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['value'], name: 'x' });
